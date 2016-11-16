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
  'LaunchRequest': () => {
    this.attributes['uid'] = uidParser(this.event.session.user.userId);
    console.log(this.attributes)
    this.emit(':ask',
      'Hello! Welcome to train status. You can ask about a specific line, or say all delays',
      ERROR.parse
    );
  },
  'ManyTrainsIntent': () => {
    getAllTrainsStatus( trains => this.emit(':tell', trains) );
  },
  'OneTrainIntent': () => {
    var train = trainSlotParser(this.event.request.intent.slots.train.value);

    if (validTrain(train)) {
      getOneTrainStatus(train, status => this.emit(':ask', status, ERROR.parse) );
    } else {
      this.emit(':ask', ERROR.train, ERROR.train);
    }
  },
  'MyTrainIntent': () => {
    var train = '';

    if (this.attributes['myTrain']) {
      train = this.attributes['myTrain'];
      getOneTrainStatus(train, status => this.emit(':ask', status, ERROR.parse) );
    } else {
      var uid = this.attributes['uid'];
      request(`http://mta.millenialsears.com/users/${uid}`, (err,res,body) => {
        var parsed = JSON.parse(body);
        if (parsed.error) {
          this.emit(':ask', 'What train do you take?', ERROR.parse);
        } else {
          train = parsed.train;
          this.attributes['myTrain'] = train;
          getOneTrainStatus(train, status => this.emit(':ask', status, ERROR.parse));
        }
      })
    }
  },
  'NewUserIntent': () => {
    var train = trainSlotParser(this.event.request.intent.slots.train.value);
    var uid = this.attributes['uid'];
    if (validTrain(train)) {
      newUser(uid, train, train => {
        this.attributes['myTrain'] = train;
        getOneTrainStatus(train, status => this.emit(':ask', status, ERROR.parse));
      });
    } else {
      this.emit(':ask', ERROR.train, ERROR.train);
    }
  },
  'ChangeTrainIntent': () => {
    var train = trainSlotParser(this.event.request.intent.slots.train.value);
    var uid = this.attributes['uid'];
    if (validTrain(train)) {
      updateUser(uid, train, status => this.emit(':ask', status, ERROR.parse));
    } else {
      this.emit(':ask', ERROR.train, ERROR.parse)
    }
  },
  'DeleteUserIntent': () => {
    var uid = this.attributes['uid'];
    deleteUser(uid, status => this.emit(':ask', status, ERROR.parse));
  },
  'AMAZON.HelpIntent': () => {
    var HELP = `Here are some things you can say:
    what trains are delayed,
    is the 4 train delayed,
    L train status,
    hows my commute`;
    this.emit(':ask', HELP, ERROR.parse);
  },
  'AMAZON.StopIntent': () => {
    this.emit(':tell', 'Goodbye.');
  },
}

function deleteUser(uid, callback) {
  request.del(`http://mta.millenialsears.com/users/${uid}`, (err, res, body) => {
    if (err || res.statusCode !== 200) {
      callback(ERROR.server);
    } else {
      callback('Your user data has been deleted.');
    }
  });
}

function updateUser(uid, train, callback) {
  var postData = {
    form: {
      train: train
    }
  };
  request.put(`http://mta.millenialsears.com/users/${uid}`, postData, (err, res, body) => {
    if (err || res.statusCode !== 200) {
      callback(ERROR.server);
    } else {
      callback(`Your new preferred train is the ${train} line.`);
    }
  });
}

function newUser(uid, train, callback) {
  var postData = {
    form: {
      uid: uid,
      train: train
    }
  };
  request.post('http://mta.millenialsears.com/users/', postData, (err, res, body) => {
    if (err || res.statusCode !== 200) {
      callback(ERROR.server);
    } else {
      callback(train);
    }
  });
}

function getAllTrainsStatus(callback) {
  request('http://mta.millenialsears.com/trains', (err, res, body) => {
    if (err || res.statusCode !== 200) {
      callback(ERROR.server);
    } else {
      callback(allTrainStatusParser(body));
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


function allTrainStatusParser(body) {
  var delayedTrains = JSON.parse(body)
    .filter( el => el["status"] !== "GOOD SERVICE" )
    .map( el => el["train"] );
  return (delayedTrains.length > 0) ? `The ${delayedTrains.join(', ')}, trains are delayed.` : 'No trains are delayed.';
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
