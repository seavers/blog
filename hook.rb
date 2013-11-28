require 'socket'
  
server = TCPServer.open 4001 
puts "Listening on port " + server.addr[1].to_s
  
loop {
  client = server.accept()
  while((x = client.gets) != "\r\n")
    puts x
  end

  client.puts "HTTP/1.1 200 OK\r\n\r\nOK"
  client.close
  puts 'OK'

  system('git pull')
  system('rake generate')
  ##system('rake deploy')	##will loop circle
  puts ''
}

