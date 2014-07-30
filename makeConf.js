var fs = require("fs");
if(!fs.existsSync("log")) {
  fs.mkdirSync("log", 0766, function(err){
    if(err){
      console.log(err);
      response.send("ERROR! Can't make the directory! \n");    // echo the result back
    }
  });
  if(!fs.existsSync("log/config.json")){
    fs.writeFile("log/config.json", JSON.stringify({
      hash: '#',
      lastTweetUsed:0,
      restartRequested:false,
      timesRestarted:0
    }), function(err) {
      if(err) {
          console.log(err);
      } else {
          console.log("The file was saved!");
      }
    });
  }
}
