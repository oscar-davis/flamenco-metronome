//************************************************************************************
// AUDIO (web audio API)

// Sound Files to Load
  // Keep track of all loaded buffers.
  var BUFFERS = {};
  // Page-wide audio context.
  var context = null;
  var gainNode;
  var masterGain = 2;
  var filter;
  var convolver;
  var impulseResponseBuffer;

  // An object to track the buffers to load {name: path}
  var BUFFERS_TO_LOAD = {
    palmaF: '/assets/sounds/palmaF.mp3', //palmas fuertas
    cajonS: '/assets/sounds/cajonS.mp3', //cajon snare
    cajonB: '/assets/sounds/cajonB.mp3' //cajon bass
  };

  // Loads all sound samples into the buffers object.
  function loadBuffers() {
    // Array-ify
    var names = [];
    var paths = [];
    for (var name in BUFFERS_TO_LOAD) {
      var path = BUFFERS_TO_LOAD[name];
      names.push(name);
      paths.push(path);
    }
    bufferLoader = new BufferLoader(context, paths, function(bufferList) {
      for (var i = 0; i < bufferList.length; i++) {
        var buffer = bufferList[i];
        var name = names[i];
        BUFFERS[name] = buffer;
      }
    });
    bufferLoader.load();
  }

  document.addEventListener('DOMContentLoaded', function() {
    try {
      // Fix up prefixing
      // .video-container removed; improve this error/fallback
      window.AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
    }
    catch(e) {
      alert('The Web Audio API is not supported in this browser. You will be redirected to the video version of the metronome.' );
      $('div.metronome').remove();
      $('div.video-container.fallback').css('display', 'block');
    }
    loadBuffers();
  });

// Buffer Loader
  function BufferLoader(context, urlList, callback) {
    this.context = context;
    this.urlList = urlList;
    this.onload = callback;
    this.bufferList = new Array();
    this.loadCount = 0;
  }

  BufferLoader.prototype.loadBuffer = function(url, index) {
    // Load buffer asynchronously
    var request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.responseType = 'arraybuffer';

    var loader = this;

    request.onload = function() {
      // Asynchronously decode the audio file data in request.response
      loader.context.decodeAudioData(
        request.response,
        function(buffer) {
          if (!buffer) {
            alert('error decoding file data: ' + url);
            return;
          }
          loader.bufferList[index] = buffer;
          if (++loader.loadCount == loader.urlList.length)
            loader.onload(loader.bufferList);
        },
        function(error) {
          console.error('decodeAudioData error', error);
        }
      );
    }

    request.onerror = function() {
      alert('BufferLoader: XHR error');
    }

    request.send();
  }

  BufferLoader.prototype.load = function() {
    for (var i = 0; i < this.urlList.length; ++i)
    this.loadBuffer(this.urlList[i], i);
  }

// Audio Playback

  //keyboard controls for testing
    document.onkeydown = function(e){
        e = e || window.event;
        var key = e.which || e.keyCode;
        if (key===66) {            //b
            play(BUFFERS.cajonB);
        } else if (key===78) {     //n
            play(BUFFERS.cajonS);
        }
    }

  function play(buffer, beat, gain) {
    var source = context.createBufferSource();
    var beat = beat || 1;
    var delay = (15 * (beat - 1) / bpm);
    var gain = gain || 1;                       //I'd like to be able to pass "0" as a value, but it comes across as false.
    source.buffer = buffer;                     //alternately: I could probably load a "silent" .wav for this.
    if (!source.start)
      source.start = source.noteOn;
    source.start(context.currentTime + delay);

    gainNode = context.createGain();
    source.connect(gainNode);
    gainNode.connect(context.destination);
    gainNode.gain.value = masterGain * gain; //bump up master gain (from .6 to 2); making up for weak MP3s coming out of garageband
  }

//************************************************************************************
// ANIMATION (User Timing API & requestAnimationFrame Method)

// Variables
  var requestId;
  var counter;
  var counterOffset;
  var pausedAt;
  var position;
  var rotation;
  var pauseDisable;

  var threshold = 0;      //sets a no-play interval to prevent rapid firing of sounds
  var timeout = true;     //ensures that the compas variable is not over-called (>>> why can't I define this in local scope?)
  var i = 0;              //for one-time reset of counterOffset in countIn
  var w = 0.8;            //sets the window of the threshold so that play functions are only called once per timeframe
  var compas = 1;         //counts numbers of compases
  var bpm = 120;
  var $hand = $('.hand');
  var countInDelay = false;
  var tempoDelay = true;

// Animaton & Timing Shims
  window.requestAnimationFrame = window.requestAnimationFrame
                                 || window.mozRequestAnimationFrame
                                 || window.webkitRequestAnimationFrame
                                 || window.msRequestAnimationFrame
                                 || function(f){setTimeout(f, 1000/60);};
  window.performance = window.performance || {}; //polyfill for Safari & others

  performance.now = (function() {
    return performance.now       ||
           performance.mozNow    ||
           performance.msNow     ||
           performance.oNow      ||
           performance.webkitNow ||
           function() { return new Date().getTime(); };
  })();

// Number Flash Functions
  function flash3() {
    var tween = TweenLite.to(".three", .2, {color:"#e50045", onComplete:reverse});
    function reverse() {
      tween.reverse( );
    }
  }
  function flash6() {
    var tween = TweenLite.to(".six", .2, {color:"#e50045", onComplete:reverse});
    function reverse() {
      tween.reverse( );
    }
  }
  function flash8() {
    var tween = TweenLite.to(".eight", .2, {color:"#e50045", onComplete:reverse});
    function reverse() {
      tween.reverse( );
    }
  }
  function flash10() {
    var tween = TweenLite.to(".ten", .2, {color:"#e50045", onComplete:reverse});
    function reverse() {
      tween.reverse( );
    }
  }
  function flash12() {
    var tween = TweenLite.to(".twelve", .2, {color:"#e50045", onComplete:reverse});
    function reverse() {
      tween.reverse( );
    }
  }

// Timing Functions
  function damp(c){
    threshold = (position + w);
    if (c && (timeout == true)) {
      compas = c;
      setTimeout(function() {
        threshold = 0;
      }, (50000 / bpm));
      setTimeout(function() {
        timeout = true;
      }, 3000);
    }
  }

  function timer(){       //timer will only ever get called roughly every 16 ms – browser caps it at 60 fps (1000/60)
      requestId = requestAnimationFrame(timer); //calls the animation & sets the ID so it can be stopped
      counter = (performance.now() - counterOffset); //sets performance.now() to where zero/last position
      position = (((counter / 1000) * (bpm/60)) % 12);  //gets compas at tempo
      rotation = (position * 30); //translates compas to degrees
      TweenLite.to(".hand", 0, {rotation:rotation});

// Playback Timing
  // compas 1
    if ((compas == 1) && (position > threshold)) {
    if      (position < (0 + w) && position > 0)  {damp(); play(BUFFERS.palmaF,1,.6); play(BUFFERS.cajonB); flash12();}
    else if (position < (1 + w) && position > 1)  {damp(); play(BUFFERS.palmaF,3,.4); }
    else if (position < (2 + w) && position > 2)  {damp(); play(BUFFERS.palmaF,1,.4); }
    else if (position < (3 + w) && position > 3)  {damp(); play(BUFFERS.palmaF,1,.6); play(BUFFERS.cajonS,1,.6); flash3();}
    else if (position < (4 + w) && position > 4)  {damp(); play(BUFFERS.palmaF,3,.4); }
    else if (position < (5 + w) && position > 5)  {damp(); play(BUFFERS.palmaF,1,.4); }
    else if (position < (6 + w) && position > 6)  {damp(); play(BUFFERS.palmaF,1,.6); play(BUFFERS.cajonS,3,.4); flash6();}
    else if (position < (7 + w) && position > 7)  {damp(); play(BUFFERS.palmaF,3,.4); play(BUFFERS.cajonS,1,.6)}
    else if (position < (8 + w) && position > 8)  {damp(); play(BUFFERS.palmaF,1,.6); play(BUFFERS.cajonB); flash8();}
    else if (position < (9 + w) && position > 9)  {damp(); play(BUFFERS.palmaF,3,.4); play(BUFFERS.cajonS,3);}
    else if (position < (10 + w) && position > 10){damp(); play(BUFFERS.palmaF,1,.6); play(BUFFERS.cajonB); flash10();}
    else if (position < (11 + w) && position > 11){damp(1);play(BUFFERS.palmaF,1,.4); }
    }
  }


// Playback Functions
  function countIn(){
    requestId = requestAnimationFrame(countIn);

    if (i == 0) {                                   // tried to define 'var i = 0;' here, but it doesn't work (console says it's not defined). why?
      counterOffset = performance.now();
      i++;
    }

    counter = (performance.now() - counterOffset);
    position = (((counter / 1000) * (bpm/60)) % 12);
    rotation = ((position * 30) - 120);
    TweenLite.to(".hand", 0, {rotation:rotation});

    if (position > threshold) {
      if      (position < (0.00 + w) && position > 0.00)  {play(BUFFERS.cajonS); flash8(); damp();}
      else if (position < (2.00 + w) && position > 2.00)  {play(BUFFERS.cajonS); flash10(); damp();}
      else if (position > 3.99 && position < 4.05) {
        cancelAnimationFrame(requestId);
        threshold = 0;
        i = 0;
        counterOffset = performance.now();
        pauseDisable = false;
        $('.pause').toggleClass('pauseDisabled');
        muteTwelve();
        return timer();
      }
    }
  }

  // mute the initial 12 count for Alegria count-in
  function muteTwelve() {
    var gainLevel = masterGain;
    masterGain = 0;
    setTimeout(function() {
      masterGain = gainLevel;
    }, ((60/bpm) * 500));
  }

  function run() {
    counterOffset = performance.now() - (54000/bpm); // runs the restart function from the one count (60/bpm*900)
    timer();
  }

  function pause() {
      cancelAnimationFrame(requestId);
      pausedAt = performance.now();
  }

  function restart() {
    counterOffset += (performance.now() - pausedAt);
    timer();
  }

// Playback Controls
  $('#start').on('click',function() {
    if (pausedAt) {
      restart();
    } else {
      pauseDisable = true;
      $('.pause').toggleClass('pauseDisabled');
      play(BUFFERS.palmaF,1,.0001);         // play muted buffer once initially to set up the audio context in iOS
      TweenLite.to(".hand", .8, {rotation:"-120_ccw", onComplete:countIn});
    }
    $('#start, #pause, #replay, #reset').toggle();
  });

  $('#pause').on('click',function() {
    if (pauseDisable == false) {
      pause();
      $('#start, #pause, #replay, #reset').toggle();
    }
  });

  $('#reset').on('click',function() {
    TweenLite.to(".hand", .5, {rotation:"30_ccw"});
    pausedAt = 0;
    threshold = 0; //prevents missed initial beats after reset
    compas = 1; //resets compas count to beginning
  });

  $('#replay').on('click',function() {
    cancelAnimationFrame(requestId);
    pauseDisable = false;
    threshold = 0;
    TweenLite.to(".hand", .5, {rotation:"25_ccw", onComplete:run});
  });

  // tempo controls
  $('#tempo').val(bpm); //sets display for starting tempo

  // tempo control buttons
  $('#upTempo').on('mousedown',function () {
      if (bpm < 240) {
        bpm++;
        $('#tempo').val(bpm);
      }
  });

  $('#downTempo').on('mousedown',function () {
       if (bpm > 60) {
        bpm--;
        $('#tempo').val(bpm);
      }
  });

  // tempo control text updates
  $('#tempo').on('change', function(e){
    var $target = $(e.target)
    if (($target.val() > 59) && ($target.val() < 241)) {
      bpm = parseInt($target.val());
      $('#tempo').blur();
    } else {
      $('#tempo').val(bpm);
    }
  });

  // keyboard controls
  $(document).on('keydown', function(e) {
      e = e || window.event;
      var key = e.which || e.keyCode;
      if ((key===32) && ($('#start').is(':visible'))) {           // space bar to play/pause
        e.preventDefault();                                       // prevents space bar from scrolling the page
        $('#start').click();
      } else if ((key===32) && ($('#pause').is(':visible'))) {    // space bar to play/pause
        e.preventDefault();
        $('#pause').click();
      } else if (key===38) {                                      // up arrow to increase tempo (not working)
        e.preventDefault();                                       // prevents up arrow from scrolling the page
       $('#upTempo').click();
      } else if (key===40) {                                      // down arrow to decrease tempo (not working)
        e.preventDefault();                                       // prevents down arrow from scrolling the page
        $('#downTempo').click();
      } else if (key===82) {                                      // "r" to reset
        $('#reset').click();
      }
  });

// To Do
  // * Object detection for browser support (and trigger appropriate fallback)
  // * Rig tempo buttons so they continue to increment when pressed & held on touchscreen
  // * Graceful handling of tempo change while metronome is running
