//处理客户端相关的
if(location.href.indexOf('webView=true') > -1) {
	jQuery('body>header,body>nav').hide();
}



//微博相关的
WB2.anyWhere(function(W){
    W.widget.connectButton({
        id: "wb_connect_btn",
        type: '3,2',
        callback : {
            login:function(o){
                //alert(o.screen_name)
            },
            logout:function(){
                //alert('logout');
            }
        }
    });
});
