var client = require('knox').createClient({
      key: process.env.s3key
    , secret: process.env.s3secret
    , bucket: 'zork'
});
var config;

var childProcess = require('child_process'),
twitterAPI = require('node-twitter-api'),
twitter = new twitterAPI({
      consumerKey: process.env.consumerKey,
      consumerSecret: process.env.consumerSecret
      //callback: 'http://yoururl.tld/something'
});

var accessTokenSecret = process.env.accessTokenSecret;
var accessToken = process.env.accessToken;

var main = function() {
  findCommand(function(command, request) {

    if (command.match(/^\s*quit\s*$/i) || command.match(/^\s*restart\s*$/i) ) {
      restartTweet();
      return;
    }
    if (config.restartRequested && command.match(/^\s*yes\s*$/i) ) {
      restartTweet();
      return;
    }
    config.restartRequested = false;
    if (command.match(/^\s*save\s*$/i)) {
      config.savedGame = config.hash;
      saveConfig();
      tweetSaved();
      return
    }
    if (command.match(/^\s*restore\s*$/i) && config.savedGame) {
      config.hash = config.savedGame;
      saveConfig();
      tweetRestored();
      return
    }

    console.log('putting command into interpreter');
    inputCommand(command, function() {
      console.log('updating twitter');
      updateTwitter(request, command);
    });
  });
};

var findCommand = function(callback) {
  twitter.search( {
    q: '@zorkmachine',
    result_type: 'recent',
    count: 10,
  },
  accessToken, accessTokenSecret, function(error, response) {

    var tweetRequest = response.statuses[0];
    if (tweetRequest.id === config.lastTweetUsed) {
      return;
    }
    config.lastTweetUsed = tweetRequest.id;
    config.lastUser = tweetRequest.user.screen_name;

    var command = tweetRequest.text.replace(/^.*@zorkmachine /i, '');
    callback(command, tweetRequest);
  });
}

var inputCommand = function(command, callback) {
  var phantom = childProcess.exec('phantomjs ph_run.js "' + config.hash + '" "' + command.replace(/"/g, '\\"') + '"',
  function (error, stdout, stderr) {
    if (error) {
     console.log(error.stack);
     console.log('Error code: '+error.code);
     console.log('Signal received: '+error.signal);
    }

    config.hash = stdout.replace(/(\r\n|\n|\r)/, '');
    saveConfig();

    callback();
  });
}

var updateTwitter = function(request, command) {
  var update = 'RT @' + request.user.screen_name + ' ';
  var maxLength = 117;
  var commandLen = maxLength - update.length;
  commandStr = (commandLen > command.length)
    ? command
    : command.substring(0, commandLen - 4) + '...';

  twitter.statuses('update_with_media', {
    status: update + commandStr,
    media: ["./zork.png"],
    in_reply_to_status_id: request.id_str
  }, accessToken, accessTokenSecret, function(error, response, request) {
    console.log(error);
    console.log(response);
  });

}

var tweetSaved = function() {
  twitter.statuses('update', {
    status: 'Your game has been saved. Tweet "restore" @ZorkMachine to restore it.',
  }, accessToken, accessTokenSecret, function(error, response, url) {
    console.log(error);
  });
};
var tweetRestored = function() {
  twitter.statuses('update', {
    status: "Your game has been loaded.",
  }, accessToken, accessTokenSecret, function(error, response, url) {
    console.log(error);
  });
};
var restartTweet = function() {
  if (config.restartRequested) {
    config.restartRequested = false;
    config.timesRestarted = config.timesRestarted
      ? config.timesRestarted + 1
      : 1;
    config.hash = '#';
    twitter.statuses('update', {
      status: "Welcome to Twitter Plays Zork. You are likely to be eaten by a Grue",
    }, accessToken, accessTokenSecret, function(error, response, url) {
      console.log(error);
    });
  } else {
    config.restartRequested = true;
    twitter.statuses('update', {
      status: "Are you sure you want to restart?",
    }, accessToken, accessTokenSecret, function(error, response, url) {
      console.log(error);
    });
  }
  saveConfig();
}

var saveConfig = function() {
  config.count++;
  var string = JSON.stringify(config);
  var req = client.put('/zork/config.json', {
      'x-amz-acl': 'public-read',
      'Content-Length': string.length,
      'Content-Type': 'application/json'
  });
  req.on('response', function(res){
    if (200 == res.statusCode) {
      console.log('config saved to %s', req.url);
    }
  });
  req.end(string);
}

client.getFile('/zork/config.json', function(err, res){
    var body = '';

    res.on('data', function(chunk) {
        body += chunk;
    });

    res.on('end', function() {
        config = JSON.parse(body)
        console.log("Got response: ", config);
        main();
    });

});
