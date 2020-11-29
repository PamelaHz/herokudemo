$(function(){
	let localStorage = window.localStorage;
	var socket = io();

	socket.on('connect', function(){
		socket.emit('new connection', {token: localStorage.getItem('token'), username:localStorage.getItem('username'), color:localStorage.getItem('color')});
	});

	$('form').submit(function(e){
		let msg = $('#m').val();
		e.preventDefault();
		socket.emit('chat message', msg);
		$('#m').val('');
		return false;
	});

	socket.on('chat message', function(username, msg){
		if(username === localStorage.getItem('username')){
			$('#messages').append('<li>' + msg.bold());
		} else{
			$('#messages').append('<li>' + msg);
		}
	});

	socket.on('update data', function(data){
		localStorage.setItem('username', data.username);
		localStorage.setItem('token', data.token);
		localStorage.setItem('color', data.color);
	});

	socket.on('update username', function(username){
		localStorage.setItem('username', username);
	});

	socket.on('update color', function(color){
		localStorage.setItem('color', color);
	});

	socket.on('update users', function(list){
		$('#userlist').empty();
		for(let i = 0; i < list.length; i++){
			if(list[i] === localStorage.getItem('username')){
				$('#userlist').append('<li><b>' + list[i] + ' (You)</b></li>');
			} else{
				$('#userlist').append('<li>' + list[i] + '</li>');
			}
		}
	});

	socket.on('add user', function(username){
		$('#userlist').append('<li>' + username + '</li>');
	});

	socket.on('chat history', function(messages){
		$('#messages').empty();
		for(let i = 0; i < messages.length; i++){
			$('#messages').append('<li>'+messages[i]+'</li>');
		}
	});

	socket.on('server message', function(msg){
		$(".container p").html('<h1>'+ msg.title+'</h1>' + msg.content);
		$("#overlay").show();
	});

	$("#overlay").click(function () {
		$("#overlay").hide();
	});

});