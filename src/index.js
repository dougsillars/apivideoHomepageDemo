import 'dotenv/config';
import express from 'express';

//express for the website and pug to create the pages
const app = express();
const pug = require('pug');
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var rtmpEndpoint;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine','pug');
app.use(express.static('public'));
//favicons are the cool little icon in the browser tab
var favicon = require('serve-favicon');
app.use(favicon('public/icon.ico')); 
//app.use(express.limit('2G'));
var bodyParser = require('body-parser')
app.use(bodyParser.json({limit: '2Gb'}));

//formidable takes the form data and saves the file, and parameterises the fields into JSON
const formidable = require('formidable')
//email-validator to validate the email address
var validator = require("email-validator");

//ctreate timers to measure upload and processing timings
    let startUploadTimer;
	let uploadCompleteTimer;
	let playReadyTimer;
	
	
//file system - we need this to delete files after they are uploaded.
var fs = require('fs');
//apivideo
const apiVideo = require('@api.video/nodejs-sdk');
//set up api.video client with my production key
//I keep my key in a .env file to keep it private.
//if you have a .env file, make sure you add it to your .gitignore file
var client = new apiVideo.Client({ apiKey: process.env.apivideoKeyProd});






//get request is the initial request - loads the start.pug
//start.pug has the form
app.get('/', (req, res) => {
	console.log("get index loaded");
	var live = req.query.live;
	if(live){
		//we have to add a livestream!
		console.log("live!");
		
		//live & socket stuff
		var spawn = require('child_process').spawn;
		const server = require('http').createServer(app);
		var io = require('socket.io')(server);
		spawn('ffmpeg',['-h']).on('error',function(m){
			console.error("FFMpeg not found in system cli; please install ffmpeg properly or make a softlink to ./!");
			process.exit(-1);
		});
		
		//TODO live stuff
		//i need to set up a  RTMP server from the list
		//list of streams from api.video
		let streamList = client.lives.search();
		
		streamList.then(function(streams) {
			
			let streamCount = streams.length;
			var streamKey;
			var streamId;
			//pick a random stream, and make sure it is not broadcasting
			var counter =0;
			let chosenStream = streamPicker(streams,counter);
			console.log("stream chosen",streams[chosenStream]);
			if (chosenStream <0){
				//TODO
				//Error message required
			}else{
				//valid stream
				
				streamKey = streams[chosenStream].streamKey;
				streamId = streams[chosenStream].liveStreamId;
				rtmpEndpoint = "rtmp://broadcast.api.video/s/"+streamKey;
				console.log("rtmp endpoint",rtmpEndpoint );
			}
			//we've esablished the stream, 
			var streamUrl = "https://embed.api.video/live/" + streamId;
			//var iframecode = "iframe src='"+player+"#autoplay'  width = '100%' frameborder='0' scrolling='no'";
				
			var iframecode = "iframe src='"+streamUrl+"' controls width='100%' frameborder='0' scrolling='no'";
			var videoResponse = "live response here";
			return res.render('index', {iframecode, videoResponse, rtmpEndpoint});
			
		});
		
		
		
		
	}else{
	
		var iframecode = "img src='https://s3-us-west-2.amazonaws.com/s.cdpn.io/1810676/video_placeholder.png' width='100%'";
		var videoResponse = "When you upload a video, the API response will appear here."
		//not live..just loading the page
		
		return res.render('index', {iframecode, videoResponse});
	}
	
  
});

//the form posts the data to the same location
//so now we'll deal with the submitted data
app.post('/', (req,res) =>{
	
    //formidable reads the form
	var form = new formidable.IncomingForm({maxFileSize : 2000 * 1024 * 1024}); //2 Gb
	//console.log("form",form);
	//use .env feil to set the directory for the video uploads
	//since we will be deleting the files after they uplaod to api.video
	//make sure this directory is full write and delete
	form.uploadDir = process.env.videoDir;
    
	//TODO form validation (mp4 file type, etc)
	form.parse(req, (err, fields, files) => {
    if (err) {
		console.log(err);
		next(err);
		return;
    }
	//testing - writing fields and info on the file to the log
   // console.log('Fields', fields);
  //  console.log('Files', files.source);
	
	var date = new Date();
	var videoTitle = date.getTime();
	//uploading.  Timers are for a TODO measuring upload & parsing time
	startUploadTimer = Date.now();
	console.log("start upload", startUploadTimer);
	let result = client.videos.upload(files.source.path, {title: videoTitle});
	
	//the result is the upload response
	//see https://docs.api.video/5.1/videos/create-video
	//for JSON details
	result.then(function(video) {
		uploadCompleteTimer = Date.now();
		console.log("upload complete", uploadCompleteTimer);
		//console.log("video",video);
		var videoJson = JSON.stringify(video, null, 2);
	   //delete file on node server
		fs.unlink(files.source.path, function (err) {
    	if (err) throw err;
    	// if no error, file has been deleted successfully
    	console.log('File deleted!');
		}); 
      //video is uploaded, but not yet published.	
	  //check video status until it is published
	  //when video is playable return the video page
	  videoStatus(video);
		 //this means that the video is now playable
		  //so load video.pug, to display the video to the user.
	  function videoStatus(video) {
	  	//get info about video
	  	let videoId = video.videoId;
	  	let iframe  = video.assets.iframe;
		let player = video.assets.player;
	  	let playable = false;
	  	let status = client.videos.getStatus(videoId);
	      status.then(function(videoStats){
	      	//console.log('status', status);
			//we have the video uploaded, now we need to wait for encoding to occur
	  		playable = videoStats.encoding.playable;
	  		console.log('video playable?',videoStats.encoding.playable, playable);
	  		if (playable){
	  			//video is ready to be played
				//and we can get the mp4 url now as well
	  			console.log("ready to play the video");
	  			playReadyTimer = Date.now();
				let uploadSeconds = (uploadCompleteTimer-startUploadTimer)/1000;
				let processSeconds = (playReadyTimer - uploadCompleteTimer)/1000;
				console.log("video uploaded in: ", uploadSeconds);
				console.log("video processed in: ", processSeconds);
	  			//now we can get the MP4 url, and send the email and post the response
				//now we add the tags to let zapier know it s ready to go
				
				var videoResponse = "Video uploaded in: "+ uploadSeconds+"s \n Video processed in: " + processSeconds +"s \n "+videoJson;
				console.log("videoResponse", videoResponse);
				var iframecode = "iframe src='"+player+"#autoplay'  width = '100%' frameborder='0' scrolling='no'";
				console.log(iframecode);
				
	  		   return res.render('index', {iframecode, videoResponse});
		   	 		
	  		}else{
	  			//not ready so check again in 2 seconds.
	  			console.log("not ready yet" );
	  			setTimeout(videoStatus(video),2000);
	  		}

			
			
	  	}).catch(function(error) {
	  	  console.error(error);
	  	});;	
	  }  
	  
	  
      
	  
	  
	//if upload fails  
	}).catch(function(error) {
	  console.error(error);
	});
	
//	console.log(result.response);


});
});

//streaming stuff
var spawn = require('child_process').spawn;

spawn('ffmpeg',['-h']).on('error',function(m){

	console.error("FFMpeg not found in system cli; please install ffmpeg properly or make a softlink to ./!");
	process.exit(-1);
});
io.on('connection', function(socket){
	console.log("connection");
	socket.emit('message','Hello from mediarecorder-to-rtmp server!');
	socket.emit('message','Please set rtmp destination before start streaming.');
	console.log('message','Hello from mediarecorder-to-rtmp server!');
	console.log('message','Please set rtmp destination before start streaming.');
	
	
	
	var ffmpeg_process, feedStream=false;

/*	
	socket.on('config_rtmpDestination',function(m){
		if(typeof m != 'string'){
			socket.emit('fatal','rtmp destination setup error.');
			return;
		}
		var regexValidator=/^rtmp:\/\/[^\s]*$/;//TODO: should read config
		if(!regexValidator.test(m)){
			socket.emit('fatal','rtmp address rejected.');
			return;
		}
		rtmpEndpoint=m;
		console.log('message','rtmp destination set to:'+m);
		socket.emit('message','rtmp destination set to:'+m);
	}); 
*/	

	//socket._vcodec='libvpx';//from firefox default encoder
	socket.on('config_vcodec',function(m){
		if(typeof m != 'string'){
			socket.emit('fatal','input codec setup error.');
			
			return;
		}
		if(!/^[0-9a-z]{2,}$/.test(m)){
			socket.emit('fatal','input codec contains illegal character?.');
			return;
		}//for safety
		socket._vcodec=m;
	}); 	


	socket.on('start',function(m){
		if(ffmpeg_process || feedStream){
			
			socket.emit('fatal','stream already started.');
			console.log('fatal','stream already started.');
			return;
		}
		if(!rtmpEndpoint){
			socket.emit('fatal','no destination given.');
			console.log('fatal','no destination given.');
			return;
		}
		
		var framerate = parseInt(socket.handshake.query.framespersecond);
		var audioBitrate = parseInt(socket.handshake.query.audioBitrate);
	    var audioEncoding = "64k";
		if (audioBitrate ==11025){
			audioEncoding = "11k";
		} else if (audioBitrate ==22050){
			audioEncoding = "22k";
		} else if (audioBitrate ==44100){
			audioEncoding = "44k";
		}
		console.log("audio numbers" , audioEncoding, audioBitrate);
		console.log("apivideo server", rtmpEndpoint);
		//default keyint is 250. but we want 2 for 1fps
		var key = Math.min(250, framerate*2);
		var keyint = "keyint="+key;
		//keyint_min default is 25
		var keyint_min = Math.min(25, framerate*2);
			var ops = [
				'-i','-',
				 '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', 
				'-max_muxing_queue_size', '1000', 
				'-bufsize', '5000',
				//'-r', '1', '-g', '2', '-keyint_min','2', 
			       '-r', framerate, '-g', framerate*2, '-keyint_min',keyint_min, 
					'-x264opts',keyint, '-crf', '25', '-pix_fmt', 'yuv420p',
			        '-profile:v', 'baseline', '-level', '3', 
     				'-c:a', 'aac', '-b:a',audioEncoding, '-ar', audioBitrate, 
			        '-f', 'flv', rtmpEndpoint		
		
		];
	
	    console.log("ops", ops);
		console.log("rtmp endpoint", rtmpEndpoint);
		ffmpeg_process=spawn('ffmpeg', ops);
		console.log("ffmpeg spawned");
		feedStream=function(data){
			
			ffmpeg_process.stdin.write(data);
			//write exception cannot be caught here.	
		}

		ffmpeg_process.stderr.on('data',function(d){
			socket.emit('ffmpeg_stderr',''+d);
			console.log('ffmpeg_stderr',''+d);
		});
		ffmpeg_process.on('error',function(e){
			console.log('child process error'+e);
			socket.emit('fatal','ffmpeg error!'+e);
			feedStream=false;
			socket.disconnect();
		});
		ffmpeg_process.on('exit',function(e){
			console.log('child process exit'+e);
			socket.emit('fatal','ffmpeg exit!'+e);
			socket.disconnect();
		});
	});

	socket.on('binarystream',function(m){
		if(!feedStream){
			socket.emit('fatal','rtmp not set yet.');
			console.log('fatal','rtmp not set yet.');
			ffmpeg_process.stdin.end();
			ffmpeg_process.kill('SIGINT');
			return;
		}
		feedStream(m);
	});
	socket.on('disconnect', function () {
		console.log("socket disconected!");
		feedStream=false;
		if(ffmpeg_process)
		try{
			ffmpeg_process.stdin.end();
			ffmpeg_process.kill('SIGINT');
			console.log("ffmpeg process ended!");
		}catch(e){console.warn('killing ffmpeg process attempt failed...');}
	});
	socket.on('error',function(e){
		
		console.log('socket.io error:'+e);
	});
});

io.on('error',function(e){
	console.log('socket.io error:'+e);
});




//streaming stuff






server.listen(3001, () =>
  console.log('Example app listening on port 3001!'),
);
process.on('uncaughtException', function(err) {
    // handle the error safely
    console.log(err)
    // Note: after client disconnect, the subprocess will cause an Error EPIPE, which can only be caught this way.
})

function streamPicker(streams, counter){
	console.log(counter);
	var chosenStream;
	let streamCount = streams.length;
	console.log(streamCount);
	let randomNumber = Math.floor(Math.random()*streamCount);
	console.log("streampicking", streams[randomNumber]);
	if(!streams[randomNumber].broadcasting){
		//the chosen stream is NOT broadcasting
		chosenStream = randomNumber;
	}else{
		//chosen stream IS broadcasting
		//pick another
		//but not to infinity - otherwise the demo will break!
		counter++;
		if (counter < streamCount*2){
			streamPicker(streams, counter);	
		}
		else{
			chosenStream = -1;
		}
	}
	return chosenStream;
	
}


