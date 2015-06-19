/**
 * Copyright 2014 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/*global $:false */

'use strict';

// TODO: refactor this into multiple smaller modules

var Microphone = require('./Microphone');
var models = require('./models');
var initViews = require('./views').initViews;
var initSocket = require('./socket').initSocket;
var display = require('./views/display');
var utils = require('./utils');

var micSocket;

$(document).ready(function() {

  function initFileUpload(token, model, file, callback) {

    var baseString = '';
    var baseJSON = '';

    var options = {};
    options.token = token;
    options.message = {
      'action': 'start',
      'content-type': 'audio/l16;rate=44100',
      'interim_results': true,
      'continuous': true,
      'word_confidence': true,
      'timestamps': true,
      'max_alternatives': 3
    };
    options.model = model.name;

    function onOpen(socket) {
      console.log('socket opened');
    }

    function onListening(socket) {
      console.log('connection listening');
      callback(socket);
    }

    function onMessage(msg) {
      console.log('ws msg', msg);
      if (msg.results) {
        // Convert to closure approach
        baseString = display.showResult(msg, baseString);
        baseJSON = display.showJSON(msg, baseJSON);
      }
    }

    function onError(err) {
      console.log('err', err);
    }

    initSocket(options, onOpen, onListening, onMessage, onError);

  }

  function initMicrophone(token, model, mic, callback) {
    // Test out websocket
    var baseString = '';
    var baseJSON = '';

    var options = {};
    options.token = token;
    options.message = {
      'action': 'start',
      'content-type': 'audio/l16;rate=16000',
      'interim_results': true,
      'continuous': true,
      'word_confidence': true,
      'timestamps': true,
      'max_alternatives': 3
    };
    options.model = model;

    function onOpen(socket) {
      console.log('socket opened');
      callback(socket);
    }

    function onListening(socket) {

      micSocket = socket;

      mic.onAudio = function(blob) {
        if (socket.readyState < 2) {
          socket.send(blob)
        }
      };
    }

    function onMessage(msg, socket) {
      console.log('ws msg', msg);
      if (msg.results) {
        // Convert to closure approach
        baseString = display.showResult(msg, baseString);
        baseJSON = display.showJSON(msg, baseJSON);
      }
    }

    function onError(err, socket) {
      console.log('err', err);
    }

    initSocket(options, onOpen, onListening, onMessage, onError);

  }

  // Make call to API to try and get token
  var url = '/token';
  var tokenRequest = new XMLHttpRequest();
  tokenRequest.open("GET", url, true);
  tokenRequest.onload = function(evt) {

    var token = tokenRequest.responseText;
    console.log('Token ', decodeURIComponent(token));

    var mic = new Microphone();

    var modelOptions = {
      token: token
      // Uncomment in case of server CORS failure
      // url: '/api/models'
    };

    // Get available speech recognition models
    // Set them in storage
    // And display them in drop-down
    models.getModels(modelOptions, function(models) {

      console.log('STT Models ', models);

      // Save models to localstorage
      localStorage.setItem('models', JSON.stringify(models));

      // Set default current model
      localStorage.setItem('currentModel', 'en-US_BroadbandModel');


      // INITIALIZATION
      // Send models and other
      // view context to views
      var viewContext = {
        models: models
      };
      initViews(viewContext);
      utils.initPubSub();

      function handleSelectedFile(file) {
        var currentModel = localStorage.getItem('currentModel');
        initFileUpload(token, currentModel, file, function(socket) {
          console.log('Uploading file', file);
          var blob = new Blob([file], {type: 'audio/l16;rate=44100'});
          utils.parseFile(blob, function(chunk) {
            console.log('Handling chunk', chunk);
            socket.send(chunk);
          });
        });
      }

      function handleFileUploadEvent(evt) {
        console.log('handling file drop event');
        // Init file upload with default model
        var file = evt.dataTransfer.files[0];
        handleSelectedFile(file);
      }

      console.log('setting target');

      var dragAndDropTarget = $(document);
      dragAndDropTarget.on('dragenter', function (e) {
        console.log('dragenter');
        e.stopPropagation();
        e.preventDefault();
      });

      dragAndDropTarget.on('dragover', function (e) {
        console.log('dragover');
        e.stopPropagation();
        e.preventDefault();
      });

      dragAndDropTarget.on('drop', function (e) {
        console.log('File dropped');
        e.preventDefault();
        var evt = e.originalEvent;
        // Handle dragged file event
        handleFileUploadEvent(evt);
      });

      var fileUploadDialog = $("#fileUploadDialog");

      fileUploadDialog.change(function(evt) {
        var file = fileUploadDialog.get(0).files[0];
        console.log('file upload!', file);
        handleSelectedFile(file);
      });

      $("#fileUploadTarget").click(function(evt) {
        fileUploadDialog
          .trigger('click');
      });


      // Set microphone state to not running
      localStorage.setItem('running', false);

      var recordButton = $('#recordButton');
      recordButton.click($.proxy(function(evt) {

        // Prevent default anchor behavior
        evt.preventDefault();

        var running = JSON.parse(localStorage.getItem('running'));

        localStorage.setItem('running', !running);

        console.log('click!');

        var currentModel = localStorage.getItem('currentModel');

        console.log('running state', running);

        if (!running) {
          console.log('Not running, initMicrophone()');
          recordButton.css('background-color', '#d74108');
          recordButton.find('img').attr('src', 'img/stop.svg');
          initMicrophone(token, currentModel, mic, function(result) {
            recordButton.css('background-color', '#d74108');
            recordButton.find('img').attr('src', 'img/stop.svg');
            console.log('starting mic');
            mic.record();
          });
        } else {
          console.log('Stopping microphone, sending stop action message');
          recordButton.removeAttr('style');
          recordButton.find('img').attr('src', 'img/microphone.svg');
          // micSocket.send(JSON.stringify({'action': 'stop'}));
          var emptyBuffer = new ArrayBuffer(0);
          micSocket.send(emptyBuffer);
          mic.stop();
        }

      }, this));

    });
  }
  tokenRequest.send();

});

