var express = require('express');
var app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var path = require('path');

app.use(express.static(path.join(__dirname, '/public')));

let instructions = "To change your username simply type:<br /> /name new-username<br/> To change the color of your username type:<br /> /color new-color-in-hexadecimal-value";

var userCounter = 1;
let messageCounter = 0;

let sockets = [];
let onlineUsers = [];
let messages = [];

let userList = {
	usernames: [],
	colors: [],
	tokens: []
};

function getTimeStamp(){
	let date = new Date();
	let hours = date.getHours();
	let min = date.getMinutes();
	if(min < 10){
		min = '0'+ min;
	}
	if(hours === 0){
		hours = 12;
	} else if( hours < 10){
		hours = '0' +hours;
	}
	return hours+":"+min;
}

function generateUsername(){
	return "User" + userCounter++;
}

function generateToken(){
	return Math.random().toString(36).substring(7);
}

function uniqueUsername(username){
	if(userList.usernames.includes(username.toLowerCase())){
		return false;
	}
	return true;
}

function updateMessages(time, name, color, msg){
	if(messageCounter >= 200){
		messages.shift();
	} else{
		messageCounter++;
	}
	let message = {
		time: time,
		username:name,
		color: color,
		msg: msg
	};
	messages.push(message);
}

function getUsernameFromSocket(id){
	let index = sockets.indexOf(id);
	return userList.usernames[index];
}

function getcolorFromSocket(id){
	let index = sockets.indexOf(id);
	return userList.colors[index];
}

function sendChatHistory(socket){
	let history = [];
	let user = getUsernameFromSocket(socket.id);
	for(let i = 0; i < messages.length; i++){
		let msg = messages[i].time+ " " + messages[i].username.fontcolor(messages[i].color) + ": " + messages[i].msg;
		if(messages[i].username === user){
			msg = msg.bold();
		}
		history.push(msg);
	}
	socket.emit('chat history', history);
}

function removeUser(socketid){
	let index = sockets.indexOf(socketid);
	let user = userList.usernames[index];
	let indexOnline = onlineUsers.indexOf(user);
	onlineUsers.splice(index,1);
	sockets.splice(index, 1);
	userList.usernames.splice(index,1);
	userList.tokens.splice(index,1);
	userList.colors.splice(index,1);
}

function updateOnlineUserList(prevName, newName){
	for(let i = 0; i < onlineUsers.length; i++){
		if(onlineUsers[i] === prevName){
			onlineUsers[i] = newName;
		}
	}
}

function updateUserList(prevName, newName){
	for(let i = 0; i < userList.usernames.length; i++){
		if(userList.usernames[i] === prevName){
			userList.usernames[i] = newName;
		}
	}
}

function updatecolorList(name, color){
	for(let i = 0; i < userList.usernames.length; i++){
		if(userList.usernames[i] === name){
			userList.colors[i] = color;
		}
	}
}

function updateMessageColor(name, color){
	for(let i = 0; i < messages.length; i++){
		if(messages[i].username === name){
			messages[i].color = color;
		}
	}
}

function updateHistoryName(prevName, newName){
	for(let i = 0; i < messages.length; i++){
		if(messages[i].username === prevName){
			messages[i].username = newName;
		} 
	}
}

function isValidColor(color){
	let result = typeof color === 'string' && color.length === 6 && !isNaN(Number('0x' +color));
	return result;
}

function parseEmoji(string){
	let regex = "";
	if(string.includes(":)") || string.includes(":D")){
		regex = new RegExp('[:][)D]', 'g');
		string = string.replace(regex, "&#128513;");
	}
	if(string.includes(";)")){
		regex = new RegExp('[;][)]', 'g');
		string = string.replace(regex, "&#128521;");
	}
	if(string.includes(":(")){
		regex = new RegExp('[;:][(]', 'g');
		string = string.replace(regex, "&#128543;");
	}
	if(string.includes(":o") || string.includes(":O")){
		regex = new RegExp('[;:][o]', 'g');
		string = string.replace(regex, "&#128562;");
	}
	if(string.includes("-.-")){
		regex = new RegExp('[-][.][-]', 'g');
		string = string.replace(regex, "&#128529;");
	}
	return string;
}

function executeCommand(type, data, socket){
	switch(type){
		case "/name":
			if(uniqueUsername(data)){
				let index = sockets.indexOf(socket.id);
				let prevname = userList.usernames[index];
				updateOnlineUserList(prevname, data);
				updateUserList(prevname, data);
				updateHistoryName(prevname, data);
				console.log(onlineUsers);
				console.log(userList.usernames);
				for(let i = 0; i < sockets.length; i++){
					let socket = io.sockets.connected[sockets[i]];
					sendChatHistory(socket);
				}
				socket.emit('update username', data);
				io.emit('update users', onlineUsers);
			} else{
				socket.emit('server message', {title:"Unable to change your username!", content:"That username is already taken. Please try again"});
			}
			break;
		case "/color":
			if(isValidColor(data)){
				let color = data;
				let index = sockets.indexOf(socket.id);
				updatecolorList(userList.usernames[index], color);
				updateMessageColor(userList.usernames[index], color);
				socket.emit('update color', color);
				for(let i = 0; i < sockets.length; i++){
					let socket = io.sockets.connected[sockets[i]];
					sendChatHistory(socket);
				}
			} else {
				socket.emit('server message', {title:"Unable to change your username color!", content:"The value you provided is invalid. Please try again!"});
			}
			break;
		case "/help":
			socket.emit('server message', {title:"Commands", content:instructions});
			break;
		default:
			socket.emit('server message', {title:"That command does not exist",content:"Type /help if you would like to see the available commands"});
			break;
	}
}

app.get('/', (req, res) => {
	res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
	console.log('a user connected');

	socket.on('new connection', (data) => {
		let username = data.username;
		let token = data.token;
		let color = data.color;
		let newTab = false;
		if(username === null || (!uniqueUsername(username) && !userList.tokens.includes(token))){ // new user or different user already has username
			username = generateUsername();
			token = generateToken();
			color = '000000';
		} 
		else if(!uniqueUsername(username) && userList.tokens.includes(token)){ // same user different tab
			newTab = true;

		}
		socket.emit('update data', {username:username, token:token, color:color});
		if(!newTab){
			onlineUsers.push(username);
			socket.broadcast.emit('add user', username);
		} 

		sockets.push(socket.id);
		userList.usernames.push(username);
		userList.tokens.push(token);
		userList.colors.push(color);
		socket.emit('update users', onlineUsers);
		let title = "Welcome " + username + "!";

		socket.emit('server message', {title:title, content:instructions});

		sendChatHistory(socket);
		
	});

	socket.on('chat message', (msg) => {
		if(msg.charAt(0) === "/"){
			let command = msg.split(" ");
			executeCommand(command[0], command[1], socket);
		} else{
			let time = getTimeStamp();
			let index = sockets.indexOf(socket.id);
			let name = userList.usernames[index];
			let color = userList.colors[index];

			msg = parseEmoji(msg);

			let message = time + " " + name.fontcolor(color) + ": " + msg;
			updateMessages(time, name, color, msg);
			io.emit('chat message', name, message);
		}
	});

	socket.on('disconnect', () =>{
		console.log('user disconnected');
		removeUser(socket.id);
		socket.broadcast.emit('update users', onlineUsers);
	});


});

http.listen(process.env.PORT || 5432, () =>{
	console.log('listening on *:5432');
});
