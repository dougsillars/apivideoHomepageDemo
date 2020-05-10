const queryString = window.location.search;
console.log(queryString);
const urlParams = new URLSearchParams(queryString);
const live = urlParams.get('live');
console.log("live?",live);
var framerate = 10;
var audioBitrate = 11025;
var width = 240;
var height = 240;

if(live){
	
	var mediaRecorder;
 	//var socket =io();
 	var socket;
	
	var state ="stop";
	console.log("state initiated = " +state); 
	connect_server();
   
    
   
      //onloadstuff
    window.onload = function(){
    //define the video player  and url 
 	   	const player = videojs('liveVideo');
		console.log("player",player);
	//check to see if the video exists or not 
	//it only exists once a stream has started
        setTimeout(function (){
     
			var liveManifest = document.getElementById("liveManifest").innerHTML;
			var liveResponse = document.getElementById("liveResponse").innerHTML;
			
			console.log("liveManifest",liveManifest);
			//add player
			console.log("adding video url!");
	    	player.src({
	      	  	src: liveManifest,
	      	  	type: 'application/x-mpegURL'
	   	 	});
			document.getElementsByClassName("serverResponse")[0].innerHTML = liveResponse;
			console.log("player.src",player.src);
          },15000);  
	  }
	
	

}
 
 
 
 function thisFileUpload() {
    //get VOD video to upload
	 const fileElement = document.getElementById('file');
	 fileElement.click();
	//upload file to NodeJS for upload to api.video
	fileElement.addEventListener("change", function() {	
		console.log("fileslist", fileElement.files);
	    console.log("file selected", document.getElementById('file').files[0]);
		uploadForm.submit("/", method = 'POST',  enctype="multipart/form-data");
		 
		});
    //send to Node server to uploa
	console.log('done');
};

 function initiateLivestream() {
	 //set up livestream
	 //warm up the camera
	 connect_server();
	
	 livestreamForm.requestSubmit();
	
  }




function video_show(stream){
	console.log("videoshow");
	//console.log("output_video", output_video);
	if ("srcObject" in output_video) {
	//	console.log("videoshowif");
		output_video.muted = true;
		output_video.srcObject = stream;
		
	} else {
	//	console.log("videoshowelse");
		output_video.src = window.URL.createObjectURL(stream);
		
	}
  output_video.addEventListener( "loadedmetadata", function (e) {
	  console.log("outputvideoevent listener");
  		console.log(output_video);
		output_message.innerHTML="Local video source size:"+output_video.videoWidth+"x"+output_video.videoHeight ;
	}, false );
	//console.log("output_video", output_video);
}

function show_output(str){
	output_console+="\n"+str;
	console.log("response data",str);
	output_console.scrollTop = output_console.scrollHeight;
};

	function connect_server(){

		var socketio_address = "/";
		console.log("connect server started");
		navigator.getUserMedia = (navigator.mediaDevices.getUserMedia ||
                          navigator.mediaDevices.mozGetUserMedia ||
                          navigator.mediaDevices.msGetUserMedia ||
                          navigator.mediaDevices.webkitGetUserMedia);
		if(!navigator.getUserMedia){fail('No getUserMedia() available.');}
		if(!MediaRecorder){fail('No MediaRecorder available.');}
        
		var socketOptions = {secure: true, reconnection: true, reconnectionDelay: 1000, timeout:15000, pingTimeout: 			15000, pingInterval: 45000,query: {framespersecond: framerate, audioBitrate: audioBitrate}};
		
		//start socket connection
		console.log("socket address", socketio_address);
		socket = io.connect(socketio_address, socketOptions);
		console.log("socket", socket);
		// console.log("ping interval =", socket.pingInterval, " ping TimeOut" = socket.pingTimeout);
 		//output_message.innerHTML=socket;
		
		socket.on('connect_timeout', (timeout) => {
   			console.log("state on connection timeout= " +timeout);
			output_message.innerHTML="Connection timed out";
			//recordingCircle.style.fill='gray';
			
		});
		socket.on('error', (error) => {
   			console.log("state on connection error= " +error);
			output_message.innerHTML="Connection error";
		//	recordingCircle.style.fill='gray';
		});
		
		socket.on('connect_error', function(){ 
   			console.log("state on connection error= " +state);
			console.log("Connection Failed");
			output_message.innerHTML="Connection Failed";
		//	recordingCircle.style.fill='gray';
		});

		socket.on('message',function(m){
			console.log("state on message= " +state);
			console.log('recv server message',m);
			output_message.innerHTML+=('SERVER:'+m);
			
		});

		socket.on('fatal',function(m){

			output_message.innerHTML+=('Fatal ERROR: unexpected:'+m);
			//alert('Error:'+m);
			console.log("fatal socket error!!", m);
			console.log("state on fatal error= " +state);
			//already stopped and inactive
			console.log('media recorder restarted');
			//recordingCircle.style.fill='gray';
			
			//mediaRecorder.start();
			//state="stop";
			//restart the server
	
		
			//should reload?
		});
		
		socket.on('ffmpeg_stderr',function(m){
			//this is the ffmpeg output for each frame
			output_message.innerHTML+=('FFMPEG:'+m);	
		});

		socket.on('disconnect', function (reason) {
			console.log("state disconec= " +state);
			output_message.innerHTML+=('ERROR: server disconnected!');
			console.log('ERROR: server disconnected!' +reason);
			//recordingCircle.style.fill='gray';
			//reconnect the server
			//connect_server();
		
	
		});
	
		state="ready";
		console.log("connected state = " +state);
		console.log("connect server successful");
	//	output_message.innerHTML="connect server successful";
		requestMedia();
}
function requestMedia(){
/*	var audioBitrate = 11025;
	var width = 240;
	var height = 240;
	var framerate = 15;
	*/
	console.log("request media");
	var constraints = { audio: {sampleRate: audioBitrate},
		video:{
	        width: { min: 100, ideal: width, max: 1920 },
	        height: { min: 100, ideal: height, max: 1080 },
			frameRate: {ideal: framerate}
	    }
	};
	console.log(constraints);
	navigator.getUserMedia = (navigator.mediaDevices.getUserMedia ||
                      navigator.mediaDevices.mozGetUserMedia ||
                      navigator.mediaDevices.msGetUserMedia ||
                      navigator.mediaDevices.webkitGetUserMedia);
	navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
		//let supported = navigator.mediaDevices.getSupportedConstraints();
		//console.log(supported);
		console.log("chose the camera");
		video_show(stream);//only show locally, not remotely
		//recordingCircle.style.fill='red';
		//socket.emit('config_rtmpDestination', url);
		socket.emit('start','start');
		mediaRecorder = new MediaRecorder(stream);
		mediaRecorder.start(250);

		//show remote stream
		var livestream = document.getElementsByClassName("Livestream");
		console.log("adding live stream");
		livestream.innerHtml = "test";

		mediaRecorder.onstop = function(e) {
			console.log("stopped!");
			console.log(e);
			//stream.stop();
				
		}
		
		mediaRecorder.onpause = function(e) {
			console.log("media recorder paused!!");
			console.log(e);
			//stream.stop();
				
		}
		
		mediaRecorder.onerror = function(event) {
			let error = event.error;
			console.log("error", error.name);

  	  };	
		
		mediaRecorder.ondataavailable = function(e) {
		//  console.log("ondataavailable");
		  socket.emit("binarystream",e.data);
		  state="start";
		  //chunks.push(e.data);
		}
	}).catch(function(err) {
		//console.log('The following error occured: ' + err);
		//this goes to the 
		//show_output('Live stream error:'+err);
		console.log('Live stream error:'+err);
		console.log(err);
		var error ="unknown";
		var errorMessage = "Sorry, an unknown error occurred.";
		var blackbox = document.getElementsByClassName("serverResponse");
		//there is only one element with the class serverResponse
		if(err.message){
			error = err.message;
		}
		
		
		if(error.includes("Invalid constraint")){
			//getUserMedia is not supported in the browser (probably safari)
			errorMessage="Sorry, but your browser does not support the APIs for live streaming.  Please try Firefox, Chrome or Edge.";
		}else if("The request is not allowed"){
			errorMessage="Sorry, but you must allow camera and microphone access to record video.";
			
		}
		blackbox[0].innerHTML=errorMessage;
		 state="stop";
		
	});
}


function stopStream(){
	  	console.log("stop pressed:");
	  	//stream.getTracks().forEach(track => track.stop())
	  	mediaRecorder.stop();
	 // 	recordingCircle.style.fill='gray';

}