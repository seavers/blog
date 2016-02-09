---
layout: post
title: "linux repeat"
date: 2013-12-04 15:32:01 +0800
comments: true
categories: 
- ubuntu
---

linux下循环执行命令, 小工具, 觉得有用, 可收录

<!--more-->

```
	vi ~/.bash_aliases
```

```
repeat() {
    n=100
    s=1

    while true; do
        arg=$1
        if [ "$arg" == "-n" ]; then
            n=$2
            shift
            shift
        elif [ "$arg" == "-s" ]; then
            s=$2
            shift
            shift
        else
            break
        fi
    done

    while [ $((n -= 1)) -ge 0 ]; do
        "$@"
        sleep $s
    done
}
```

```
	source ~/.bash_aliases
```

```
	repeat ls -l
	repeat date
	repeat iostat
	repeat -n 3 curl 'http://www.lianghaijun.com'
	repeat -n 3 -s 300 curl 'http://www.lianghaijun.com'
	repeat -n 3 -s 0.5 sh -c "curl -I -s 'http://www.lianghaijun.com' | head -1"
```



