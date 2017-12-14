var express = require('express');

var logger = require('morgan');
var csrf = require('csurf');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var ejs = require('ejs');
var moment = require('moment');
var steem = require('steem');

// setup route middlewares
var csrfProtection = csrf({ cookie: true });
var parseForm = bodyParser.urlencoded({ extended: false });

// Put account info here
var steemAcct = {username: 'steemretro', activeKey: '55'};

var app = express();

app.use(logger('dev'));
app.use(cookieParser());
app.use(express.static(__dirname + '/static'));

app.set('view engine', 'jade');

app.get('/', csrfProtection, function (req, res, next) {
  try {
    var csrfToken = req.csrfToken();
    res.render('index', { csrfToken: csrfToken });
  } catch (e) {
    next(e);
  }
})

app.get('/highscores', csrfProtection, function (req, res, next) {
  var highscores = [];
  var sortedScores;
  res.setHeader('Content-Type', 'application/json');
  steem.api.setOptions({url:'https://api.steemit.com'});
  steem.api.getAccountHistory(steemAcct.username,-1,1000, function(err, response){
    response.forEach(function(item){
      if (item[1].op[0] === 'custom_json') {
        if (item[1].op[1].id == 'pacman-live') {
          var scoreInfo = JSON.parse(item[1].op[1].json);
          if (["","undefined",null,undefined].indexOf(scoreInfo.username) < 0) {
            highscores.push({username: scoreInfo.username, highscore: scoreInfo.highscore});
          }
        }
      }
    });
    sortedScores = highscores.sort(function(a,b){return b.highscore - a.highscore});
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(sortedScores.slice(0,10)));
  });
})

app.post('/checkname', parseForm, csrfProtection, function (req, res, next) {
  res.setHeader('Content-Type', 'application/json');
  steem.api.getAccounts([req.body.playerName], function(err, result){
    if (!err) {
      if (result[0]) {
        res.send(JSON.stringify({valid: true}));
      } else {
        res.send(JSON.stringify({valid: false}));
      }
    } else {
      console.log(err);
    }
  });
})

app.post('/savescore', parseForm, csrfProtection, function (req, res, next) {
  var n = req.body.n;
  var s = req.body.s;
  var l = req.body.l;
  var cheater = ((l < 1) || ((s / l) > (1600 + 1240)));

  if (!cheater) {
    steem.broadcast.customJson(steemAcct.activeKey, [steemAcct.username], [], 'pacman-live', JSON.stringify({username: n, highscore: s, level: l, timestamp: moment.utc().valueOf()}), function(err, response){
      if (err) {
        console.log(err);
        res.status(500).send({success: false});
      } else {
        var gameEarnings = Number((s / 1000000) < 0.001 ? 0.001 : s / 1000000).toFixed(3);
        var transferMsg = "Congratulations on achieving a highscore of " + s + " on level " + l + " at SteemPacman! Your earnings are " + gameEarnings + " STEEM.";
        steem.broadcast.transfer(steemAcct.activeKey, steemAcct.username, n, gameEarnings + ' STEEM', transferMsg, function(err, result){
          console.log(err ? err : result);
        });
        res.send(JSON.stringify({success: true}));
      }
    });
  }
})

app.listen(process.env.PORT || 5000, function () {
  console.log('Listening on http://localhost:' + (process.env.PORT || 5000))
})
