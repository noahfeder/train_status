'use strict';
const Alexa = require('alexa-sdk');

const request = require('request');

const ERROR = {
  parse: 'What was that?',
  server: `I couldn't get that information.`,
  train: 'Invalid train, please try again.'
};

exports.handler = function(event, context, callback){
    var alexa = Alexa.handler(event, context);
    alexa.registerHandlers(handlers);
    alexa.execute();
};

var handlers = {
  'LaunchRequest': function() {
    this.emit(':ask',
      'Hello! Welcome to train status.',
      ERROR.parse
    );
  },
  'ManyTrainsIntent': function() {
    getAllTrainsStatus( trains => this.emit(':tell', trains) );
  },
  'OneTrainIntent': function() {
    var train = trainSlotParser(this.event.request.intent.slots.train.value);

    if (validTrain(train)) {
      getOneTrainStatus(train, status => this.emit(':ask', status, ERROR.parse) );
    } else {
      this.emit(':ask', ERROR.train, ERROR.train);
    }
  },
  'MyTrainIntent': function() {
    var train = '';
    if (this.attributes['myTrain']) {
      train = this.attributes['myTrain'];
      getOneTrainStatus(train, status => this.emit(':ask', status, ERROR.parse) );
    } else {
      var uid = uidParser(this.event.session.user.userId);
      request(`http://mta.millenialsears.com/users/${uid}`, (err,res,body) => {
        var parsed = JSON.parse(body);
        if (parsed.error) {
          this.emit(':ask', 'What is your train?', ERROR.parse);
        } else {
          train = parsed.train;
          this.attributes['myTrain'] = train;
          getOneTrainStatus(train, status => this.emit(':ask', status, ERROR.parse));
        }
      })
    }
  },
  'NewUserIntent': function() {
    var train = trainSlotParser(this.event.request.intent.slots.train.value);
    var uid = uidParser(this.event.session.user.userId);
    if (!validTrain(train)) {
      this.emit(':ask', ERROR.train, ERROR.train);
    } else {
      makeNewUser(uid, train, train => {
        if (train === 'WHOOPS') {
          this.emit(':ask', 'Invalid train, please try again!', 'Invalid train, please try again!');
        } else {
          this.attributes['myTrain'] = train;
          getOneTrainStatus(train, status => this.emit(':ask', status, ERROR.parse));
        }
      })
    }

  }
}

function makeNewUser(uid, train, callback) {
  var postData = {
    form: {
      uid: uid,
      train: train
    }
  };
  request.post('http://mta.millenialsears.com/users/', postData, () => callback(train) );
}

function getAllTrainsStatus(callback) {
  request('http://mta.millenialsears.com/trains', (err, res, body) => {
    if (err || res.statusCode !== 200) {
      callback(ERROR.server);
    } else {
      var delayedTrains = JSON.parse(body)
        .filter( el => el["status"] !== "GOOD SERVICE" )
        .map( el => el["train"] );
      if (delayedTrains.length > 0) {
        callback(`The ${delayedTrains.join(', ')}, trains are delayed.`);
      } else {
        callback('No trains are delayed.');
      }
    }
  })
}

function getOneTrainStatus(train, callback) {
  request(`http://mta.millenialsears.com/trains/${train}`, (err, res, body) => {
    if (err || res.statusCode !== 200) {
      callback(ERROR.server);
    } else {
      callback(singleTrainStatusParser(body));
    }
  })
}

function singleTrainStatusParser(body) {
  var parsed = JSON.parse(body);
  switch (parsed.status) {
    case 'GOOD SERVICE':
      return `The ${parsed.train}, train is on time.`;
    case 'PLANNED WORK':
      return `There is planned work on the ${parsed.train}, line.`;
    case 'SERVICE CHANGE':
      return `There is a service change on the ${parsed.train}, line.`;
    default:
      return `There are delays on the ${parsed.train}, line.`;
  }
}
function trainSlotParser(train) {
  switch (train) {
      case 'fore': case 'for':
        return '4';
      case 'gee':
        return 'G';
      case 'won': case 'wun': case 'one':
        return '1';
      case 'to': case 'two': case 'too':
        return '2';
      case 'be': case 'bee':
        return 'B';
      case 'sea': case 'see':
        return 'C';
      case 'eff': case 'if':
        return 'F';
      case 'cue': case 'queue':
        return 'Q';
      case 'are':
        return 'R';
      default:
        return train.toUpperCase();
    }
}

function validTrain(train) {
  var validTrains = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'J', 'L', 'M', 'N',
    'Q', 'R', 'S', 'Z', '1', '2', '3', '4', '5', '6', '7'
  ];
  return !(validTrains.indexOf(train) < 0);
}

function uidParser(longUidString) {
  var fullUid = longUidString.split('.');
  return fullUid[fullUid.length - 1];
}
