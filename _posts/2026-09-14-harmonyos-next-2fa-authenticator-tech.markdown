---
layout: post
title: "基于 HarmonyOS NEXT 的 2FA 双因子身份验证器技术方案与实现解析"
date: 2026-09-14 09:20:00 +0800
comments: true
categories:
- 鸿蒙
- 安全
tags:
- HarmonyOS
- 2FA
- TOTP
- 安全加密
- ArkTS
---

随着现代互联网安全防护意识的提高，双因子身份验证（Two-Factor Authentication, 简称 2FA）已经成为保护云平台、代码仓库（如 GitHub、GitLab）以及关键业务系统的标配防线。常见的两步验证主要是基于时间的动态一次性口令（TOTP, Time-Based One-Time Password）。

在 HarmonyOS NEXT（纯血鸿蒙）生态全面推进的背景下，脱离了传统的 Android 兼容层，我们需要一款完全基于 ArkTS 原生开发、零网络依赖、纯离线本地加密的轻量级身份验证器。

本文将从技术架构与算法落地的角度，深入解析如何在 HarmonyOS NEXT 上完整实现符合国际 RFC 6238 规范的原生 2FA 身份验证器。

---

## 一、TOTP 算法与 RFC 6238 规范核心原理

TOTP（RFC 6238）是基于事件的计数器口令 HOTP（RFC 4226）在时间维度上的扩展。它的核心计算逻辑可以抽象为一个确定性的数学函数：

$$\text{TOTP} = \text{Truncate}(\text{HMAC-SHA-1}(K, C)) \pmod{10^{\text{Digits}}}$$

其中各个参数的含义与计算流程如下：

1. **共享密钥（Secret Key, $K$）**：由服务端生成并通过 Base32 编码（如 `JBSWY3DPEHPK3PXP`）。在客户端计算前需将其还原解码为原始的二进制字节数组。
2. **时间步长计数器（Time-Step Counter, $C$）**：
   $$C = \left\lfloor \frac{T - T_0}{X} \right\rfloor$$
   - $T$ 为当前系统的 Unix 时间戳（秒）；
   - $T_0$ 为时间起点（标准规定为 0，即 1970-01-01 00:00:00 UTC）；
   - $X$ 为步长周期（默认通常为 30 秒）。
   得到整数 $C$ 后，需要将其转换为标准的 **8 字节大端格式（Big-Endian）二进制数据**。
3. **HMAC 散列计算**：使用共享密钥 $K$ 对 8 字节计数器 $C$ 进行散列计算（通常为 HMAC-SHA1，部分系统亦支持 HMAC-SHA256）。
4. **动态截断（Dynamic Truncation）**：
   - 取 HMAC 输出的最后一个字节（第 19 字节）的低 4 位（`hmac[19] & 0x0F`）作为偏移量 $\text{Offset}$（取值范围 0~15）；
   - 从 HMAC 结果的第 $\text{Offset}$ 字节开始连续取出 4 个字节；
   - 屏蔽最高位符号位（避免负数运算），拼装成一个 31 位的无符号整数；
   - 对 $10^{\text{Digits}}$ 求模，不足位数时左侧补 0，生成最终呈现给用户的 6 位或 8 位数字口令。

---

## 二、HarmonyOS NEXT 核心技术实现

在原生鸿蒙平台上实现上述流程，主要涉及四大核心模块：**加密引擎**、**协议解析**、**安全沙箱存储**以及**响应式动效驱动**。

### 1. 双轨加密引擎与优雅降级容灾

在鸿蒙系统上，我们可以利用原生提供的 `@ohos.security.cryptoFramework` 调用系统底层的硬件加密加速。但在实际开发与测试中，考虑到某些运行环境（如开发阶段的轻量模拟器、IDE 预览器）可能缺少底层加解密驱动，我们在架构上设计了 **“硬件加密优先 + 纯 ArkTS 手写算法降级兜底”** 的双轨方案：

```typescript
import cryptoFramework from '@ohos.security.cryptoFramework';

export class TotpUtil {
  /**
   * 优先调用系统原生安全框架计算 HMAC，发生异常时自动切换至纯软件实现
   */
  private static computeHmac(keyBytes: Uint8Array, messageBytes: Uint8Array, algorithm: string): Uint8Array {
    try {
      const algUpper: string = algorithm.toUpperCase();
      const hmacSpec: string = algUpper === 'SHA256' ? 'SHA256' : 'SHA1';

      // 1. 初始化鸿蒙对称密钥生成器与密钥实例
      const symKeyGen = cryptoFramework.createSymKeyGenerator('HMAC');
      const symKey = symKeyGen.convertKeySync({ data: keyBytes });

      // 2. 初始化 MAC 实例并完成数据散列
      const mac = cryptoFramework.createMac(hmacSpec);
      mac.initSync(symKey);
      mac.updateSync({ data: messageBytes });
      const macOutput = mac.doFinalSync();

      return macOutput.data;
    } catch (err) {
      // 容灾降级：使用纯 ArkTS 算法引擎
      return TotpUtil.computeFallbackHmac(keyBytes, messageBytes, algorithm);
    }
  }
}
```

降级算法内置了符合 FIPS PUB 180-1 规范的完整 SHA-1 块填充与主循环运算，从而确保了核心计算在任何设备或测试环境下均具备 100% 的可靠性。

### 2. Base32 密钥解码与动态截断

Base32 将 5 位二进制数据映射为一个字符（A-Z, 2-7）。解码过程需要严格将连续的 5-bit 数据流切分重组为标准的 8-bit 字节：

```typescript
public static decodeBase32(input: string): Uint8Array {
  const cleanInput: string = input.replace(/[\s-]/g, '').toUpperCase();
  if (cleanInput.length === 0) return new Uint8Array(0);

  let bits: number = 0;
  let value: number = 0;
  const output: number[] = [];

  for (let i = 0; i < cleanInput.length; i++) {
    const char: string = cleanInput.charAt(i);
    if (char === '=') break;
    const charIndex: number = TotpUtil.BASE32_ALPHABET.indexOf(char);
    if (charIndex === -1) continue;

    value = (value << 5) | charIndex;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return new Uint8Array(output);
}
```

动态截断算法实现：

```typescript
// 执行 RFC 4226 Dynamic Truncation
const offset: number = hmacResult[hmacResult.length - 1] & 0x0f;
const codeNumber: number =
  ((hmacResult[offset] & 0x7f) << 24) |
  ((hmacResult[offset + 1] & 0xff) << 16) |
  ((hmacResult[offset + 2] & 0xff) << 8) |
  (hmacResult[offset + 3] & 0xff);

const modulo: number = Math.pow(10, digits);
const resultNum: number = codeNumber % modulo;
return resultNum.toString().padStart(digits, '0');
```

---

### 3. otpauth:// 协议统一解析与导入

市面上所有的 2FA 服务提供商（如 Google、GitHub、AWS 等）生成二维码或配置信息时，均统一遵循 `otpauth://` 协议规范：

```text
otpauth://totp/GitHub:developer@domain.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub
```

在客户端解析中，主要需要处理好不同服务商命名规范的差异：
- **Label 部分**：可能采用 `Issuer:Account` 格式，也可能仅有 `Account`；
- **Query 参数**：包含 `secret`、`issuer`、`algorithm`、`digits`、`period` 等参数；
- **优先级兼并**：Query 中的 `issuer` 优先级高于 Label 中的前缀，若两者均缺省则回退至账号标签。

在 UI 层，我们同时集成了系统扫码 Ability 与剪贴板自动监听，当用户复制了包含 `otpauth://` 的链接时，表单会自动激活并完成信息提取，大幅简化了输入成本。

---

### 4. 零网络权限与本地沙箱持久化

作为一款安全工具，“信任”建立在透明与极简的设计之上。该验证器在 `module.json5` 中**完全没有申请 `ohos.permission.INTERNET` 网络权限**，从系统权限层物理阻断了私钥外泄的可能。

所有账号凭据与密钥均使用 HarmonyOS 原生用户首选项 `@ohos.data.preferences` 保存于应用专属的本地沙箱路径中：

```typescript
import preferences from '@ohos.data.preferences';
import common from '@ohos.app.ability.common';

export class StorageUtil {
  private static readonly PREF_NAME: string = 'dahai_authenticator_store';
  private static prefInstance: preferences.Preferences | null = null;

  public static async init(context: common.Context): Promise<void> {
    if (StorageUtil.prefInstance) return;
    StorageUtil.prefInstance = await preferences.getPreferences(context, StorageUtil.PREF_NAME);
    // 从本地安全沙箱加载凭据缓存
  }

  public static async persist(): Promise<void> {
    if (!StorageUtil.prefInstance) return;
    const jsonString: string = JSON.stringify(StorageUtil.memoryCache);
    await StorageUtil.prefInstance.put('key_accounts_list', jsonString);
    await StorageUtil.prefInstance.flush();
  }
}
```

---

## 三、关于本工具

基于以上技术方案落地的应用：**身份验证器 Authenticator**（2FA）。

- **产品定位**：专为 HarmonyOS NEXT（纯血鸿蒙）生态打造的双因子安全验证工具。
- **核心特点**：
  - **纯血原生体验**：ArkTS 原生高刷界面，丝滑圆环倒计时与一键快速复制；
  - **绝对离线安全**：零联网权限、密钥存储于本地加密沙箱，杜绝云端拖库风险；
  - **便捷管理**：支持多账号快速模糊检索、重要账号置顶（Pin）、支持相机扫码与链接一键识别；
  - **极简无扰**：完全去除开屏与信息流广告，启动秒开。

欢迎访问本工具的官方宣传展示与在线 TOTP 体验主页：

- 宣传主页与在线体验：[https://2fa.dahai.online](https://2fa.dahai.online)
- 开发者主站：[https://dahai.online](https://dahai.online)
