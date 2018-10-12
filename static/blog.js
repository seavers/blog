//处理客户端相关的
if(location.href.indexOf('webView=true') > -1) {
	jQuery('body>header,body>nav').hide();
}

//微博相关的
if(window.WB2) {
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
}

function addSidebarToggler() {
  if(!$('body').hasClass('sidebar-footer')) {
    $('#content').append('<span class="toggle-sidebar"></span>');
    $('.toggle-sidebar').bind('click', function(e) {
      e.preventDefault();
      if ($('body').hasClass('collapse-sidebar')) {
        $('body').removeClass('collapse-sidebar');
      } else {
        $('body').addClass('collapse-sidebar');
      }
    });
  }
  var sections = $('aside.sidebar > section');
  if (sections.length > 1) {                                                 
    sections.each(function(index, section){
      if ((sections.length >= 3) && index % 3 === 0) {
        $(section).addClass("first");
      }
      var count = ((index +1) % 2) ? "odd" : "even";
      $(section).addClass(count);
    });
  }
  if (sections.length >= 3){ $('aside.sidebar').addClass('thirds'); }
}

$('document').ready(function() {
  addSidebarToggler();
});
