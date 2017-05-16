var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.get('/', function(req, res){
    res.send('<h1>Hello world</h1>');
});

io.on('connect', socket => {
    console.log("New connection. Auth = " + socket.handshake.query.auth);

    socket.on('message', (dto) => {
        console.log(dto);
    });

    socket.on('emote', (cbId, dto) => {
        console.log(dto);
    });

    socket.on('memberList', (dto) => {
        console.log(dto);
    });

    socket.on('memberAdd', (dto) => {
        console.log(dto);
    });

    socket.on('memberRemove', (dto) => {
        console.log(dto);
    });

    socket.on('requestRoom', (cbId, dto) => {
        console.log(dto);
        io.emit(cbId, ['!test:room.com', '!another:room.com']);
    });
});

http.listen(8082, function(){
    console.log('listening on *:8082');
});