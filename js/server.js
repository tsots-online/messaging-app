var http = require('http'),
    fs = require('fs'),
    io = require('socket.io'),
    url = require('url'),
    qs = require('querystring'),
    Populate = require('./populate.js'),
    Storage = require('./storage.js').Storage,
    socket, users = [], storage, client;

init();

function serveStaticFile(filename, type, res) {
  fs.readFile(filename, function (err, data) {
    if (data) {
      res.writeHead(200, { 'Content-Type': type });
      res.end(data);
    } else {
      serveErrorPage(res);
    }
  });
}

function serveErrorPage(res) {
  fs.readFile('error.html', 'utf8', function (err2, data2){
    res.writeHead(404);
    if (err2) {
      res.end('File Not Found!');
    } else {
      res.end(data2);
    }
  });
}

function init() {
  var store = require('redis');
  socket = initSocketIO(startServer());
  setEventHandlers(socket);
  client = store.createClient();
  storage = new Storage(client);
}

function initSocketIO(app) {
	var socket = io.listen(app);
	socket.configure(function(){
		socket.set('transports', ['websocket']);
		socket.set('log level', 2);
	});
  return socket;
}

function setEventHandlers(socket) {
	socket.sockets.on('connection', function(client) {
	  client.on('login', function(data) {
      onLoginUser(this, data);
    });
	  client.on('send:message', function(data) {
      onSendMessage(this, data);
    });
	  client.on('populate', function(data) {
      onPopulate();
    });
  });
}

function startServer() {
  var PORT = 8000,
      app;

  app = http.createServer(function(req, res) {
    var pathname = url.parse(req.url).pathname;
    handleGet(pathname, res)
  }).listen(PORT);

  console.log("Server started on port", PORT);
  return app;
}

function handleGet(pathname, res) {
  if (pathname === '/') {
    serveStaticFile('index.html', 'text/html', res);
  } else if(/^\/get\//.test(pathname)) {
    console.log('YO');
    var data = pathname.substring(pathname.indexOf('/', 1) + 1, pathname.indexOf('?') && pathname.length);
    onGetData(res, data);
  } else {
    var type = pathname.indexOf('.js') > -1 ? 'text/javascript' :
               pathname.indexOf('.html') > -1 ? 'text/html' :
               pathname.indexOf('.css') > -1 ? 'text/css' :
               pathname.indexOf('.svg') > -1 ? 'image/svg+xml' :
               'text/plain';
    serveStaticFile(pathname.substring(1), type, res);
  }
}

/**
 * This is a quick, simple function to register the user on the redis database
 * TODO:
 * data sanitization and checking
 */
function onLoginUser(client, data) {
  storage.getUser({uname: data.username}, function(result) {
    if (result) {
      //password is currently trivial first and last name combination
      if (result.first_name + result.last_name === data.password) {
        client.emit('loggedin', {id: result.id, uname: data.username});
      } else {
        sendError('That username and password combination is incorrect!');
      }
    } else {
      sendError('That username does not exist!');
    }
  });
}

function onGetData(res, type) {
  fs.readFile(type + '.json', 'utf-8', function(err, result) {
    //send test data from json file
    //when implemented flatten object with JSON.stringify
    //and parse string to JSON when used
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    console.log(err, result);
    res.end(result);
  });
}

function onNewMessage(client, data) {
  console.log(data, 'new message');
}

function onSendMessage(client, data) {
  console.log(data, 'send message');
}

function sendError(msg) {
  socket.sockets.emit('error', {msg: msg});
}

function onPopulate() {
  var data = new Populate(client);
  data.populateUsers();
  data.populateMessages();
  data.populateAnnouns();
}
