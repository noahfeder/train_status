'use strict';
const Alexa = require('alexa-sdk');

const request = require('request');

exports.handler = function(event, context, callback){

    var alexa = Alexa.handler(event, context);
    alexa.registerHandlers(handlers);
    alexa.execute();

};

var handlers = {
  'LaunchRequest': function () {
    var say = 'Welcome!';
    this.emit(':ask', say, 'try again');
  },
  'ManyTrainsIntent': function() {
    var say = '';

    getAllTrainsStatus( trains => {
      if (trains[0]) {
        say = `The ${trains.join(', ')}, are delayed.`;
      } else {
        say = 'No trains are delayed.';
      }
       this.emit(':tell', say );
    })
  },
  'OneTrainIntent': function() {
    var train = this.event.request.intent.slots.train.value;

    switch (train) {
      case 'fore': case 'for':
        train = '4'; break;
      case 'gee':
        train = 'G'; break;
      case 'won': case 'wun': case 'one':
        train = '1'; break;
      case 'to': case 'two': case 'too':
        train = '2'; break;
      case 'be': case 'bee':
        train = 'B'; break;
      case 'sea': case 'see':
        train = 'C'; break;
      case 'eff': case 'if':
        train = 'F'; break;
      case 'cue': case 'queue':
        train = 'Q'; break;
      case 'are':
        train ='R'; break;
      default:
        train = train;
    }

    var validTrains = [
      'A', 'B', 'C', 'D', 'E',
      'F', 'G', 'J', 'L', 'M',
      'N', 'Q', 'R', 'S', 'Z',
      '1', '2', '3', '4', '5',
      '6', '7'
    ];

    if (validTrains.indexOf(train) < 0) {
      this.emit(':tell', 'Invalid train, please try again!');
    } else {
      getOneTrainStatus(train, toSay => {
        this.emit(':ask', toSay, 'Sorry, please try again');
      })
    }
  },
  'MyTrainIntent': function() {
    var train = '';
    if (this.attributes['myTrain']) {
      train = myTrain;
      getOneTrainStatus(train, toSay => {
        this.emit(':ask', toSay, 'Sorry, please try again');
      })
    } else {
      var fullUid = this.event.session.user.userId;
      fullUid = fullUid.split('.');
      var uid = fullUid[fullUid.length - 1];
      request(`https://serene-sierra-17416.herokuapp.com/users/${uid}`, function(err,res,body) {
        var parsed = JSON.parse(body);
        if (parsed.error) {
          this.emit(':ask', 'What is your train?', 'Sorry, try again');
        } else {
          this.attributes['myTrain'] = parsed.train;
          getOneTrainStatus(parsed.train, toSay => {
            this.emit(':ask', toSay, 'Sorry, please try again');
          })
        }
      })
    }
  },
  'NewTrainIntent': function() {
    var train = this.event.request.intent.slots.train.value;

    var fullUid = this.event.session.user.userId;
    fullUid = fullUid.split('.');
    var uid = fullUid[fullUid.length - 1];

    switch (train) {
      case 'fore': case 'for':
        train = '4'; break;
      case 'gee':
        train = 'G'; break;
      case 'won': case 'wun': case 'one':
        train = '1'; break;
      case 'to': case 'two': case 'too':
        train = '2'; break;
      case 'be': case 'bee':
        train = 'B'; break;
      case 'sea': case 'see':
        train = 'C'; break;
      case 'eff': case 'if':
        train = 'F'; break;
      case 'cue': case 'queue':
        train = 'Q'; break;
      case 'are':
        train ='R'; break;
      default:
        train = train;
    }

    var validTrains = [
      'A', 'B', 'C', 'D', 'E',
      'F', 'G', 'J', 'L', 'M',
      'N', 'Q', 'R', 'S', 'Z',
      '1', '2', '3', '4', '5',
      '6', '7'
    ];

    if (validTrains.indexOf(train) < 0) {
      this.emit(':tell', 'Invalid train, please try again!');
    } else {
      makeNewUser(uid, train, train => {
        if (train === 'WHOOPS') {
          this.emit(':tell', 'Invalid train, please try again!');
        } else {
          getOneTrainStatus(train, toSay => {
            this.emit(':ask', toSay, 'Sorry, please try again');
          })
        }
      })
    }

  }
}

function makeNewUser(uid, train, callback) {
  request.post('https://serene-sierra-17416.herokuapp.com/users/', {uid: uid, train: train}, function (err, res, body) {
    var parsed = JSON.parse(body);
    if (parsed.error) {
      callback('WHOOPS');
    } else {
      callback(train);
    }
  })
}

function getAllTrainsStatus(callback) {
  request('http://81052766.ngrok.io/api/v1/trains', function(err, res, body) {
    if (err || res.statusCode !== 200) {
      callback("WHOOPS");
    } else {
      var delayedTrains = JSON.parse(body).filter( el => {
        return el["status"] !== "GOOD SERVICE";
      });

      callback(delayedTrains.map( el => el["train"] ));
    }
  })
}

function getOneTrainStatus(train, callback) {
  request(`http://81052766.ngrok.io/api/v1/trains/${train}`, function(err, res, body) {
    if (err || res.statusCode !== 200) {
      callback('There was an error looking up that information.');
    }
    var toSay = '';
    var parsed = JSON.parse(body);
    switch (parsed.status) {
      case 'GOOD SERVICE':
        toSay = `The ${parsed.train}, train is on time.`;
        break;
      case 'PLANNED WORK':
        toSay = `There is planned work on the ${parsed.train}, line.`;
        break;
      default:
        toSay = `There are delays on the ${parsed.train}, line.`;
    }
    callback(toSay);
  })
}
