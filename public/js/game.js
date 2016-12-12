// https://s3.amazonaws.com/cah/CAH_Rules.pdf
// We can choose which ones to allow by only allowing the few we want on the
// game creation page
const GAME_MODES = {
  NORMAL: 1,
  HAPPY_ENDING: 2,
  REBOOTING_THE_UNIVERSE: 3,
  PACKING_HEAT: 4,
  RANDO: 5
}

class GameSettings {
  constructor(isNSFW, gameMode, handSize, numRounds, pointLimit, submitTimeLimit, autoSubmit) {
    this.isNSFW = isNSFW;
    this.gameMode = gameMode;               // THe game mode (see above)
    this.handSize = handSize;               // The number of cards that should go in each player's hand
    this.numRounds = numRounds;             // The max number of rounds to play
    this.pointLimit = pointLimit;           // End the game if someone gets this many victoryPoints
    this.submitTimeLimit = submitTimeLimit; // The amount of time everybody has till their cards are submitted
    this.autoSubmit = autoSubmit;           // If the player hasn't chosen anything, a random card will be submitted for them
  }
}

const ROUND_STATUS = {
  SUBMITTING: 0,  // The proles submit their cards (and everybody sees how many are left to submit)
  JUDGING: 1,     // The judge picks which one they like the most
  END_OF_ROUND: 2 // The judges pick is diplayed to everybody
}

class RoundInfo {
  constructor(roundNumber, blackCard, isSubmitTwo, roundStatus, cardCzar){
    this.roundNumber = roundNumber;
    this.blackCard = blackCard;
    this.isSubmitTwo = isSubmitTwo;
    this.roundStatus = roundStatus;
    this.cardCzar = cardCzar;
    this.submittedCards = null;
  }

  // used when switching rounds
  update(blackCard, roundStatus, cardCzar){
    this.roundNumber++;
    this.blackCard = blackCard;
    this.isSubmitTwo = isSubmitTwo(blackCard);
    this.roundStatus = roundStatus;
    this.cardCzar = cardCzar;
    this.submittedCards = null;
  }

  updateStatus(roundStatus){
    this.roundStatus = roundStatus;
  }
}

class Player {
  constructor(name) {
    this.name = name;
    this.id = makeId(20);
    this.hand = [];
    this.cardsWon = [];
    this.victoryPoints = 0;
    this.isCardCzar = false;
    this.submittedCard = null;
  }

  makeCardCzar(){
    console.log("making", this.name, "the card czar");
    this.isCardCzar = true;
  }

  makeProletariat(){
    console.log("making", this.name, "a prole");
    this.isCardCzar = false;
  }

  // called by the client code when the card is placed in the "submit" location on screen
  setSubmittedCard(card){
    this.submittedCard = card;
  }

  getSubmittedCard(){
    return this.submittedCard;
  }

  // called by the game logic code during changes from SUBMITTING to JUDGING
  submitCard(){
    let temp = this.submittedCard;
    this.removeWhiteCard(temp);
    // this.submittedCard = null;
    return temp;
  }

  addWhiteCard(card){
    this.hand.push(card);
  }

  removeWhiteCard(card){
    var index = this.hand.indexOf(card);
    if(index > -1){
      this.hand.splice(index, 1);
      return true;
    } else {
      return false;
    }
  }

  addBlackCard(card){
    this.cardsWon.push(card);
    this.victoryPoints++;
  }

  // should only be used in a few of the game modes
  // we don't actually remove a card from the array (otherwise, you couldn't see which cards you won!)
  // instead we change the percieved size of the cards won;
  removeBlackCard(){
    if(victoryPoints < 0){
      return false;
    } else {
      victoryPoints--;
      return true;
    }
  }
}

const GAME_STATUS = {
  INITIALIZING: 0,
  PLAYING: 1,
  FINISHED: 2
};

const GAME_EVENTS = {
  CARD_SUBMITTED_EVENT: 0,
  CARDS_COLLECTED_EVENT: 1,
  CARDS_JUDGED_EVENT: 2,
  ROUND_CHANGE_EVENT: 3,
  GAME_OVER_EVENT: 4,
  ALL_EVENTS: 5
}

class HumanityAgainstCards {
  constructor(gameSettings) {
    this.gameId = makeId(20);
    this.gameStatus = GAME_STATUS.INITIALIZING;
    this.gameSettings = gameSettings; // GameSettings object
    console.log(this.gameSettings);

    this.players = [];      // the players in this current game
    this.cardCzar = null;   // the czar of the current round
    this.winner = null;     // the winner of the previous round
    this.roundInfo = new RoundInfo(0, null, null, null);  // the RoundInfo object that gets sent to the clients

    this.submittedCards = {};

    this.registeredEventHandlers = {};

    // Setup the deck depending on the user options
    if(!this.gameSettings.isNSFW){
      this.deck = new Deck(WHITE_CARDS, BLACK_CARDS);
    } else {
      this.deck = new Deck(SFW_WHITE_CARDS, SFW_BLACK_CARDS);
    }

  }

  registerEventHandler(eventType, handler) {
  	if (this.registeredEventHandlers[eventType] == null) {
  	    this.registeredEventHandlers[eventType] = new Array();
  	}

  	this.registeredEventHandlers[eventType].push(handler);
  }

  addPlayer(player){
    if(this.gameStatus != GAME_STATUS.FINISHED){
      this.players.push(player);

      if(this.gameStatus == GAME_STATUS.PLAYING){
        player.hand = this.deck.drawStartingHand(this.gameSettings.handSize);
      }

      // console.log("adding player: ", player.name);
      // console.log(player);
      return true;
    } else {
      return false;
    }
  }

  addPlayerToFront(player){
    if(this.gameStatus != GAME_STATUS.FINISHED){
      this.players = [player].concat(this.players);
      // console.log("adding player: ", player.name);
      // console.log(player);
      return true;
    } else {
      return false;
    }
  }

  // TODO: change to compare based off of unique ids
  removePlayer(player){
    let index = this.players.indexOf(player);
    if(index < 0){
      return false;
    } else {
      this.players.splice(index, 0);
      return true;
    }
  }

  startGame(){
    if(this.gameStatus != GAME_STATUS.INITIALIZING){
      return false;
    } else {

      if(this.gameSettings.gameMode == GAME_MODES.RANDO){
        let rando = new Player("Rando Cardrissian");
        this.addPlayerToFront(rando);
      }

      // Deal the starting cards
      for(let i = 0; i < this.players.length; i++){
        let hand = this.deck.drawStartingHand(this.gameSettings.handSize);
        if(hand){
          this.players[i].hand = hand;
        } else {
          alert("Too few cards remaining!");
          return false;
        }
      }

      let cardCzarIndex = -1;
      // choose someone as the starting card czar
      if(this.gameSettings.gameMode == GAME_MODES.RANDO){
        // Rando is always the first player in the array;
        cardCzarIndex = getRandomInt(1, this.players.length);
      } else {
        cardCzarIndex = getRandomInt(0, this.players.length);
      }

      this.players[cardCzarIndex].makeCardCzar();
      this.cardCzar = this.players[cardCzarIndex];

      // get the starting black card
      this.roundInfo.roundStatus = ROUND_STATUS.SUBMITTING;
      this.roundInfo.blackCard = this.deck.drawBlackCard();
      this.roundInfo.isSubmitTwo = isSubmitTwo(this.roundInfo.blackCard);
      this.roundInfo.cardCzar = this.cardCzar;
      console.log(this.roundInfo);

      // TODO: the network code to send out messages telling people who's got what


      this.gameStatus = GAME_STATUS.PLAYING;
    }
  }

  updateSubmission(player){
    console.log("updating " + player.name + "'s submission");
    this.submittedCards[player.id] = player.submittedCard;
    if(Object.keys(this.submittedCards).length == this.players.length - 1){
      this.collectSubmissions();
    }
  }

  // called either when everybody has submitted their cards or after the timer
  // for submissions has reached its limit
  collectSubmissions(){
    let submittedCards = [];

    for(let i = 0; i < this.players.length; i++){
      // handles removing the card from their hand
      // TODO: probably need to send the player id as well
      if(this.players[i].id != this.cardCzar.id){
        submittedCards.push(this.players[i].submitCard());
      }
    }

    this.roundInfo.updateStatus(ROUND_STATUS.JUDGING);
    this.roundInfo.submittedCards = submittedCards;
    console.log(this.roundInfo);


    // With the socket code, we should be able to send one player only their Player object!
    let handlers = this.registeredEventHandlers[GAME_EVENTS.CARDS_COLLECTED_EVENT];
    if (handlers != null) {
        for (let i = 0; i < handlers.length; i++) {
          for (let j = 0; j < this.players.length; j++){
            // TODO: implement game stats and update code here
            handlers[i](JSON.stringify(this.players[j]), JSON.stringify(this.roundInfo), null);
          }
        }
    }

  }

  // Each round follows a lifecycle of beginRound (starts the process of submitting cards)
  // followed by beginJudging (what it sounds like)
  // and engind with endRound (gets ready for next round or ends the game)
  beginRound(){
    for(let i = 0; i < this.players.length; i++){
      this.players[i].submittedCard = null; // reset the player state
    }
  }

  beginJudging(){

  }

  endRound(){
    if(this.roundInfo.roundNumber < gameSettings.numRounds){
      this.roundInfo.update(this.deck.drawBlackCard(), ROUND_STATUS.SUBMITTING, this.winner);
      this.submittedCards = {};
      this.dealCards();
      this.beginRound();
    } else {
      let maxPoints = -Infinity;
      let winner = null;

      for(let i = 0; i < this.players.length; i++){
        if(this.players[i].victoryPoints > maxPoints){
          winner = this.players[i];
          maxPoints = this.players[i].victoryPoints;
        }
      }

      this.winner = winner;
      this.gameStatus = GAME_STATUS.FINISHED;
      // TODO: alert GAME_OVER_EVENT and ALL_EVENTS listeners
    }
  }

  dealCards(){
    for(let i = 0; i < this.players.length; i++){
      while(this.players[i].hand.length < this.gameSettings.handSize){
        this.players[i].addWhiteCard(this.deck.drawWhiteCard);
      }
    }
  }

}
