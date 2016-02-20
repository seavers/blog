require 'socket'
  
server = TCPServer.open 4001 
puts "Listening on port " + server.addr[1].to_s
  
loop {
  client = server.accept()

  puts Time.now
  while((x = client.gets) != "\r\n")
    puts x
  end

  client.puts "HTTP/1.1 200 OK\r\n\r\nOK"
  client.close
  puts 'OK'

  system('git pull')
  system('jekyll build -d _deploy')
  puts ''
}

