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
