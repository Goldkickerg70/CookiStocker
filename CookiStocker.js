// ===================================================================================
/*			
		Hello and welcome.
	This is the main file of the CookiStocker mod.
	If you came to reverse engineer the code or have more questions about the algorithm
	- you can just ask for advice in the Steam guide comments.
		https://steamcommunity.com/sharedfiles/filedetails/?id=2599187047
*/

// 			Options

		// Stop trading automatically when true (not yet implemented)
		var stockerStopTrading = false
		
		// Announce transactions in game notifications
		var stockerTransactionNotifications = true

		// Make regular profit reports
		var stockerActivityReport = true
			// How often to make regular reports in ms (one hour by default)
			var stockerActivityReportFrequency = 1000 * 60 * 60

		// Make game notifications fade away on their own
		var stockerFastNotifications = false

		// Use console.log for more detailed info on prices and trends
		var stockerConsoleAnnouncements = false

		// Logic loop frequency; do not touch it unless you are cheating
		var stockerLoopFrequency = 1000 * 30

		
		// The cheat itself. Rolls the cycle every time logic loop triggers
		var stockerForceLoopUpdates = false

		var hideBogdanoff = true
		var stockerGreeting = 'click clack you are now in debt'



// ===================================================================================

if(typeof CCSE == undefined)
	Game.LoadMod('https://klattmose.github.io/CookieClicker/SteamMods/CCSE/main.js')

if(CookiStocker === undefined) var CookiStocker = {};

CookiStocker.name = 'CookiStocker';
CookiStocker.version = '2.0';
CookiStocker.GameVersion = '2.052';

if (stockList === undefined) {
	var stockList = {
		check: 'dump eet',
		goods: [],
		sessionStart: Date.now() + 500,
		sessionLastTime: Date.now() + 500,
		startingProfits: 0,
		sessionProfits: 0,
		sessionNetProfits: 0,
		sessionGrossProfits: 0,
		sessionGrossLosses: 0,
		sessionProfitableStocks: 0,
		sessionUnprofitableStocks: 0,
		sessionProfitableTrades: 0,
		sessionUnprofitableTrades: 0,
		sessionPurchases: 0,
		sessionSales: 0,
	}
}

if (!hideBogdanoff) console.log('\n\n⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣼⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣧⡀⠀⠀⠀⠀⠀⠀⠀⠈⠉⠀⠀\n⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀\n⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡆⠀⠀⠀⠀⠀⠀⠀⠀⠀\n⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀⠀⢀⣀⣀⡀\n⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣿⣿⣿⣿⣿⠿⠿⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡆⠀⠀⠀⠀⠈⠛⢿⣷\n⠀⠀⠀⠀⠀⠀⠀⠀⢀⣾⣿⣿⣿⣿⡟⠁⠀⠀⠀⠀⠀⠀⠈⠉⠉⠉⠉⠻⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠃⠀⠀⠀⠀⠀⠀⣸⣿\n⠀⠀⠀⠀⠀⠀⠀⠀⠘⣿⣿⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡄⠀⠀⠀⠀⢠⣾⣿⣿\n⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⡏⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡇⠀⠀⠀⠈⢿⣿⣿⣿\n⠃⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠁⠀⠀⠀⠀⠈⣿⣿⣿\n⠀⢀⠀⢠⠀⠀⠀⠀⠀⢿⣿⣿⣿⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⡈⠻⠟⠛⠛⢿⣿⣿⡿⠇⠀⠀⠀⠀⠀⠀⣿⣿⣿\n⣶⣿⡀⠀⠀⠀⠀⠀⠀⠀⢻⣿⠋⠀⠀⣠⣤⣄⣀⣠⣀⡀⠀⠀⢀⣤⣴⣶⣿⣿⣿⣿⣿⡆⠀⠀⠀⢻⣿⡆⠀⠀⠀⠀⠀⠀⠀⠘⠋⠀\n⣿⣿⣧⠀⠀⠀⠀⠀⠀⠀⠈⠁⠀⠀⠎⢀⣩⡽⣿⣿⣿⡏⠀⠀⠘⣿⣿⠟⠙⠿⠿⠟⠋⠀⠀⠀⠀⢀⣄⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀\n⣿⣿⠉⠀⣠⣤⡀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠉⠀⠈⠉⠉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠁⢀⣤⠄⠀⠀⠀⠀⠀⠸⡷⠀\n⣿⣿⣷⡾⠟⠋⠁⠀⠀⠀⢼⡆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⠀\n⣿⠟⠁⠀⠀⠀⠀⠀⠀⢀⣴⣿⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠐⠾⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠛⠀\n⣿⠀⠀⠀⠀⠀⠀⣰⠀⢸⣿⠛⠉⠂⠀⠀⠀⠀⠀⠀⠀⠶⠤⣴⣶⠾⠟⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀\n⠏⠀⠀⠐⡫⢀⣾⡇⠀⠈⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀\n⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣠⣴⣶⠀⠀⠄⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣠⣀⣀⣠⣤⣄⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀\n⠀⠀⠀⠀⠀⣠⣴⠀⠹⡇⢿⣿⠃⠀⠀⠐⡀⠀⢠⣴⠶⠿⠿⠿⠿⠿⠟⢛⡿⠿⣿⣿⣿⣄⠀⡆⠀⠸⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀\n⠀⠀⠀⠠⢾⣿⣟⣠⢉⣥⣼⡏⠀⠀⠀⠀⠘⣶⠁⠀⠀⢤⣤⣠⣤⣤⣶⡿⠃⠀⠹⣿⣿⣷⣾⠁⠀⠀⠀⣷⡀⠀⠀⠀⠀⠀⠀⠀⠀\n⠀⠀⠀⣠⣾⣿⣿⣿⣿⣿⡟⠀⠀⠀⠀⠀⠀⠘⣆⠀⠀⠀⠉⠛⠛⠛⠉⠀⠀⠀⢀⣿⣿⡟⠁⠀⠀⠀⠀⣰⣿⣷⣄⠀⠀⠀⠀⠀⠀⠀\n⠀⠀⠀⠐⢿⠟⠋⠙⠻⣿⣃⣀⣀⣤⣤⣶⣾⣿⠁⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣼⠟⠉⠀⠀⠀⠀⠀⣴⣿⣿⣿⣿⣦⡀⠀⠀⠀⠀⠀\n⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣿⣿⣿⣿⣿⣿⣿⡆⠸⣦⣤⣄⣀⣀⣠⣤⣤⣴⠎⠀⠀⠀⠀⠀⠀⢀⣼⣿⣿⣿⣿⣿⣿⣿⣶⣤⣤⣄⣀\n⠀⠀⠀⠀⠀⠀⠀⠀⣰⣿⣿⣿⣿⣿⣿⣿⣿⣿⡇⠀⠹⣏⠛⠛⠛⠛⠛⠉⠁⠀⠀⠀⠀⠀⠀⢠⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿\n⠀⠀⠀⢀⠀⢀⣤⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡇⠀⠀⠙⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣴⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿\n\n     wot iz he doing in ze console?\n\n\n');

var modeDecoder = ['stable','slowly rising','slowly falling','rapidly rising','rapidly falling','fluctuating'] // meanings of each market trend (good.mode)
var goodIcons = [[2,33],[3,33],[4,33],[15,33],[16,33],[17,33],[5,33],[6,33],[7,33],[8,33],[13,33],[14,33],[19,33],[20,33],[32,33],[33,33],[34,33],[35,33]];

CookiStocker.launch = function() {
	isLoaded = 1;
}

if (!CookiStocker.isLoaded){
	if (CCSE && CCSE.isLoaded) {
		CookiStocker.launch();
	}
	else {
		if(!CCSE) var CCSE = {};
		if(!CCSE.postLoadHooks) CCSE.postLoadHooks = [];
		CCSE.postLoadHooks.push(CookiStocker.launch);
	}
}
/*
CookiStocker.optionsMenu = function(){
	var hStr = ' '<div class="listing">' + CCSE.MenuHelper.ActionButton("", "Unlock Hardcore Achievement") + '</div>';
}
*/
function stockerTimeBeautifier(duration) {
	var milliseconds = Math.floor((duration % 1000) / 100),
	  seconds = Math.floor((duration / 1000) % 60),
	  minutes = Math.floor((duration / (1000 * 60)) % 60),
	  hours = Math.floor((duration / (1000 * 60 * 60)) % 24),
	  days = Math.floor(duration / (1000 * 60 * 60 * 24));
	if (seconds && (minutes || hours || days) && !stockerForceLoopUpdates)
		seconds = 0;						// Don't display
	var strSeconds = seconds + ' second' + (seconds != 1 ? 's' : '');
	var strMinutes = minutes ? minutes + ' minute' + (minutes != 1 ? 's' : '') + (seconds ? (hours || days ? ', and ' : ' and ') : '') : '';
	var strHours = hours ? hours + ' hour' + (hours != 1 ? 's' : '') + (minutes && seconds ? ', ' : ((minutes ? !seconds : seconds) ? ' and ' : '')) : '';
	var strDays = days ? days + ' day' + (days != 1 ? 's' : '') + (hours && minutes || hours && seconds || minutes && seconds ? ', ' : (((hours ? !minutes : minutes) ? !seconds : seconds) ? ' and ' : '')) : '';
	var strTime = strDays + strHours + strMinutes;
	if (stockerForceLoopUpdates && seconds)
		strTime += strSeconds; 
	if (minutes || hours || days) {
		return (strTime);
	} else
		return (strSeconds);
}

setTimeout(function waitForGame() {
	if (typeof Game === 'object' && Game.ready) {
	

Game.registerMod('CookiStocker',{
	init:function(){

		this.startStocking();
	},
	startStocking:function(){
		if (!Game.Objects['Bank'].minigame) {
			console.log('=====$$$=== Stock Market minigame has not initialised yet! Will try again in 500 ms.');
			setTimeout(() => {
				this.startStocking();
			},500);
			return
		}
		else {
			console.log('=====$$$=== CookiStocker logic loop initialised at ' + new Date());
			console.log('=====$$$=== With main options as follows:')
			console.log('=====$$$=== Logic loop frequency: ' + stockerTimeBeautifier(stockerLoopFrequency))
			console.log('=====$$$=== Report frequency: ' + stockerTimeBeautifier(stockerActivityReportFrequency))
			console.log('=====$$$=== Cheating: ' + stockerForceLoopUpdates)
			Game.Notify('CookiStocker is ready',stockerGreeting,[1,33],false);
			console.log(stockList.check);
		}
		
		var market = Game.Objects['Bank'].minigame.goodsById;	// read market
		console.log('Reading the market:');
		stockList.startingProfits = Game.Objects['Bank'].minigame.profit;
		for (let i = 0; i < market.length; i++){
			stockList.goods.push({
		 		name: market[i].name,
		 		stock: market[i].stock,
		 		currentPrice: market[i].val,
				mode: market[i].mode,
				lastMode: market[i].mode,
				lastDur: market[i].dur,
				unchangedDur: 0,
				dropCount: 0,
				riseCount: 0,
				profit: 0,
				someSold: false,
				someBought: false,
			});
			console.log('Stock: ' + market[i].name.replace('%1', Game.bakeryName) + ' Status: ' + modeDecoder[market[i].mode] + ' at $' + market[i].val + (market[i].stock ? ' (own)' : ''));
		}
		if (stockerForceLoopUpdates)
			Game.Objects['Bank'].minigame.secondsPerTick = stockerLoopFrequency / 1000;
		var stockerLoop = setInterval(function() {
			let doUpdate = false;
			
			// setting stockerForceLoopUpdates to true will make the logic loop force the market to tick every time it triggers,
			// making this an obvious cheat, and i will personally resent you.
			
			// but
			// if you backup your save and set stockerLoopFrequency to like 10 milliseconds it looks very fun and effective.
			// yes, this is how i made the gif on the steam guide page.
			if (!stockerForceLoopUpdates)
				stockerLoopFrequency = Game.Objects['Bank'].minigame.secondsPerTick * 500;		// Keep up to date
			const smallDelta = 3;
			const largeDelta = 4;
			const alwaysBuyBelow = 2;
			const neverSellBelow = 11;

			market = Game.Objects['Bank'].minigame.goodsById;	// update market
			for (let i = 0; i < market.length; i++) {
				
				let lastPrice = stockList.goods[i].currentPrice;
				let currentPrice = market[i].val;

				// update stockList
				stockList.goods[i].stock = market[i].stock;
				stockList.goods[i].currentPrice = market[i].val;
				stockList.goods[i].mode = market[i].mode;

				let md = stockList.goods[i].mode;
				let lmd = stockList.goods[i].lastMode;
				let lastStock = market[i].stock;
				let deltaPrice = largeDelta;
				let stockName = stockList.goods[i].name.replace('%1', Game.bakeryName);
				
				// Our ceilingPrice is the maximum of the bank ceiling and the (deprecated but still useful) stock ceiling
				let ceilingPrice = Math.max(10*(i+1) + Game.Objects['Bank'].level + 49, 97 + Game.Objects['Bank'].level * 3);

				if (Game.ObjectsById[i+2].amount == 0) {		// stock must be active
					console.log(`${stockName} stock is inactive`);
					continue;
				}
				if (lmd == md && (stockList.goods[i].stock && (md == 2 || md == 4) ||	// Make selling into a downturn easier
				!stockList.goods[i].stock && (md == 1 || md == 3)))			// Make buying into an upturn easier
					deltaPrice = smallDelta;
				if (md != lmd && (md == 3 && lmd != 1 || md == 4 && lmd != 2 || md == 1 && lmd != 3 || md == 2 && lmd != 4)) {
					stockList.goods[i].dropCount = 0;
					stockList.goods[i].riseCount = 0;
				} else if (currentPrice > lastPrice) {
					stockList.goods[i].dropCount = 0;
					stockList.goods[i].riseCount++;
				} else if (currentPrice < lastPrice) {
					stockList.goods[i].riseCount = 0;
					stockList.goods[i].dropCount++;
				}
				if (stockList.goods[i].lastDur != market[i].dur || ++stockList.goods[i].unchangedDur > 1) {
					stockList.goods[i].unchangedDur = 0;
					doUpdate = true;
				}
				if (stockerConsoleAnnouncements && doUpdate) {			// Tick tick
					if (md == lmd)
						console.log(`${stockName} mode is unchanged at ${lmd} [${modeDecoder[lmd]}] at $${Beautify(currentPrice, 2)}`);
					else
						console.log(`MODE CHANGE ${stockName} old mode was ${lmd} [${modeDecoder[lmd]}] and new mode is ${md} [${modeDecoder[md]}] at $${Beautify(currentPrice, 2)}`);
				}
				stockList.goods[i].lastDur = market[i].dur;
				if (	// buy conditions
					(
						currentPrice < alwaysBuyBelow || md != 4 && ((currentPrice > lastPrice &&
						stockList.goods[i].riseCount >= deltaPrice || (md == 1 || md == 3) && md != lmd || 
						md == 0 && !stockList.goods[i].someSold && stockList.goods[i].dropCount < deltaPrice &&
						currentPrice >= 10) && (currentPrice < ceilingPrice || md == 1 || md == 3))
					)
					&& Game.Objects['Bank'].minigame.buyGood(i,10000) 	// actual buy attempt
				)
				{
					// buying
					let mode = (lmd != md) ? 'is no longer in ' + modeDecoder[lmd] + ' mode' : 'is ';
					let units = market[i].stock - lastStock;

					stockList.goods[i].someBought = true;
					stockList.goods[i].stock = market[i].stock;
					if (market[i].prevBuyMode1 != undefined)
					{
						market[i].prevBuyMode1 = lmd;
						market[i].prevBuyMode2 = md;
					}
					market[i].buyTime = Date.now();
					if (typeof StockAssistant != 'undefined')
					{
						StockAssistant.stockData.goods[i].boughtVal = market[i].prev;
						StockAssistant.buyGood(i);
					}
					stockList.sessionPurchases++;
					if (stockerTransactionNotifications)
						if (currentPrice >= 2) Game.Notify(`Buying ${stockName} ${new Date().toLocaleTimeString([], {hourCycle: 'h23', hour: '2-digit', minute: '2-digit'})}`,`Buying ${units} unit${(units > 1 ? 's' : '')}. The stock ${mode} at $${Beautify(market[i].prev, 2)} per unit (your buying price) and is in ${modeDecoder[md]} mode now.`,goodIcons[i],stockerFastNotifications);
						else Game.Notify(`Buying ${stockName} ${new Date().toLocaleTimeString([], {hourCycle: 'h23', hour: '2-digit', minute: '2-digit'})}`, `Buying ${units} unit${(units > 1 ? 's' : '')}. The price has dropped below $2 per unit, and your buying price is $${Beautify(market[i].prev, 2)}.`,goodIcons[i],stockerFastNotifications);
					if (stockerConsoleAnnouncements) console.log('=====$$$=== Buying '+ stockName + ' at $' + Beautify(market[i].prev, 2));
				} else if (	// sell conditions
					stockList.goods[i].stock > 0 && (currentPrice < lastPrice &&
					stockList.goods[i].dropCount >= deltaPrice ||
					(md == 2 || md == 4) && md != lmd) && currentPrice >= neverSellBelow	// not near the bottom
				)
				{
					// selling
					let profit = 0;
					let strProfit = 'profit '
					let mode = (lmd != md) ? 'is no longer in ' + modeDecoder[lmd] + ' mode and ' : '';

					if (!Game.Objects['Bank'].minigame.sellGood(i,stockList.goods[i].stock)) {
						stockList.goods[i].lastMode = stockList.goods[i].mode	// update last mode
						continue;
					}
					stockList.goods[i].someSold = true;
					market[i].prevSale = market[i].val;
					market[i].prevSellMode1 = lmd;
					market[i].prevSellMode2 = md;
					market[i].sellTime = Date.now();
					if (typeof StockAssistant != 'undefined')
						StockAssistant.sellGood(i);
					stockList.sessionSales++;
					profit = (market[i].val - market[i].prev) * stockList.goods[i].stock;
					stockList.goods[i].profit += profit;
					if (profit > 0) {
						stockList.sessionGrossProfits += profit;
						stockList.sessionProfitableTrades++;
					} else {
						stockList.sessionGrossLosses += -profit;
						stockList.sessionUnprofitableTrades++;
					}
					stockList.sessionNetProfits += profit;
					stockerModeProfits[lmd][md][0] += profit;
					stockerModeProfits[lmd][md][1] += profit;
					stockerModeProfits[lmd][md][2]++;
					if (profit < 0)
					{
						strProfit = 'loss ';
						profit = -profit;
					}
					if (stockerTransactionNotifications) Game.Notify(`Selling ${stockName} ${new Date().toLocaleTimeString([], {hourCycle: 'h23', hour: '2-digit', minute: '2-digit'})}`,`Selling ${stockList.goods[i].stock} unit${(stockList.goods[i].stock > 1 ? 's' : '')} at a price of $${Beautify(market[i].val, 2)} per unit for a ${strProfit} of $${Beautify(profit, 2)} and total revenue of $${Beautify(market[i].val*stockList.goods[i].stock, 2)}, which is added to the total market profits. The stock ${mode} is in ${modeDecoder[md]} mode now. Bought at a price of $${Beautify(market[i].prev, 2)} per unit.`,goodIcons[i],stockerFastNotifications);
					if (stockerConsoleAnnouncements) console.log(`=====$$$=== Selling ${stockName} at $${Beautify(market[i].val, 2)} for a ${strProfit}of $${Beautify(profit, 2)} and total revenue of $${Beautify(market[i].val*stockList.goods[i].stock, 2)}. Last bought at $${Beautify(market[i].prev, 2)}.`);
				}
				
				stockList.sessionProfits = Game.Objects['Bank'].minigame.profit - stockList.startingProfits;
				stockList.goods[i].lastMode = stockList.goods[i].mode	// update last mode
			}
			stockList.sessionProfitableStocks = stockList.sessionUnprofitableStocks = 0;
			for (let i = 0; i < market.length; i++) {			// Must recalculate the whole list on every pass
				if (stockList.goods[i].profit > 0)
					stockList.sessionProfitableStocks++;
				else if (stockList.goods[i].profit < 0)
					stockList.sessionUnprofitableStocks++;
			}
		},stockerLoopFrequency);
		
		let stockerModeProfits = [
			[[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
			[[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
			[[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
			[[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
			[[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
			[[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]
		];

		if (stockerActivityReport || stockerConsoleAnnouncements) {
			var stockerReportInterval = setInterval(function() {
				let now = Date.now();
				if (now > stockList.sessionLastTime + stockerActivityReportFrequency + 500) {		// Were we sleeping?
					stockList.sessionStart += now - stockList.sessionLastTime - stockerActivityReportFrequency;
				}

				var stockerUptime = Math.floor((now - stockList.sessionStart) / 1000) * 1000;
				var totalStocks = 0;
				var totalShares = 0;
				var totalValue = 0;
				var unrealizedProfits = 0;
				let j, k;

				stockList.sessionLastTime = now;
				stockerUptime -= stockerUptime % stockerLoopFrequency;
				if (stockerActivityReport)
					if ((stockList.sessionPurchases + stockList.sessionSales) == 0) {
						Game.Notify(
							`CookiStocker report ${new Date().toLocaleTimeString([], {hourCycle: 'h23', hour: '2-digit', minute: '2-digit'})}`,
							`This session has been running for ${stockerTimeBeautifier(stockerUptime)}, but no good investment opportunities were detected! Luck is not on our side, yet.`
							,[1, 33],stockerFastNotifications
						);
					} else {
						Game.Notify(
							`CookiStocker report ${new Date().toLocaleTimeString([], {hourCycle: 'h23', hour: '2-digit', minute: '2-digit'})}`,
							`This session has been running for ${stockerTimeBeautifier(stockerUptime)} and has made $${Beautify(stockList.sessionNetProfits, 0)} in net profits and $${Beautify(stockList.sessionProfits, 0)} in revenue (displayed profits) in ${Beautify(stockList.sessionPurchases, 0)} purchases and ${Beautify(stockList.sessionSales, 0)} sales.`,[1, 33],stockerFastNotifications
						);
					}
				if (stockerConsoleAnnouncements) {
					let totalProfits = 0;
					let subtotalProfits = 0;
					let deltaTotalProfits = 0;
					let deltaSubtotalProfits = 0;
					let totalTrades = 0;
					let subtotalTrades = 0;
					let profit = 0;
					let lastProfit = 0;
					let trades = 0;
					let strProfit = '';
					let strDeltaModeProfits = '';
					let strTrades = '';

					for (j = 0; j < market.length; j++) {
						if (stockList.goods[j].stock) {
							totalStocks++;
							totalShares += stockList.goods[j].stock;
							totalValue += stockList.goods[j].stock * stockList.goods[j].currentPrice;
							unrealizedProfits += (market[j].val - market[j].prev) * stockList.goods[j].stock;
						}
					}
					console.log(`Running for ${stockerTimeBeautifier(stockerUptime)} and made $${Beautify(stockList.sessionNetProfits, 0)}\n  in net profits and $${Beautify(stockList.sessionProfits, 0)} in revenue (displayed profits)\n  in ${Beautify(stockList.sessionPurchases, 0)} purchases and ${Beautify(stockList.sessionSales, 0)} sales.\nTotal number of stocks held: ${totalStocks}.  Total shares: ${Beautify(totalShares, 0)}.\nTotal value: $${Beautify(totalValue)}.  Unrealized profits: $${Beautify(unrealizedProfits, 2)}.\nTotal gross profits:  $${Beautify(stockList.sessionGrossProfits, 0)}.  Profitable stocks:  ${stockList.sessionProfitableStocks}.\nProfitable trades:  ${stockList.sessionProfitableTrades}.  Average profit per trade:  $${stockList.sessionGrossProfits ? Beautify(stockList.sessionGrossProfits / stockList.sessionProfitableTrades, 2) : 0}.\nTotal gross losses:  $${Beautify(stockList.sessionGrossLosses, 0)}.  Unprofitable stocks:  ${stockList.sessionUnprofitableStocks}.\nUnprofitable trades:  ${stockList.sessionUnprofitableTrades}.  Average loss per trade:  $${stockList.sessionGrossLosses ? Beautify(stockList.sessionGrossLosses / stockList.sessionUnprofitableTrades, 2) : 0}.`);
					
					// Stats for individual modes
					for (j = 0; j < 6; j++)
						for (k = 0; k < 6; k++)
							totalProfits += stockerModeProfits[j][k][0];
					for (j = 0; j < 6; j++)
						for (k = 0; k < 6; k++) {
							profit = stockerModeProfits[j][k][0];
							lastProfit = stockerModeProfits[j][k][1];
							trades = stockerModeProfits[j][k][2];
							strProfit = profit ? ((100 * profit/totalProfits).toFixed(2) + '%').padStart(8) : '';
							strDeltaModeProfits = (lastProfit ? '$' + Beautify(lastProfit, 2) : '').padStart(14);
							strTrades = trades ? (' ' + trades + ' trade' + (trades > 1 ? 's' : ' ')).padStart(13) : '';
							
							console.log(`Profits[${j}][${k}] = $${Beautify(profit, 2).padEnd(14)} ${strProfit}${strDeltaModeProfits}${strTrades}`);
							subtotalProfits += profit;
							deltaSubtotalProfits += lastProfit;
							deltaTotalProfits += lastProfit;
							subtotalTrades += trades;
							totalTrades += trades;
						}
						
					// Stats for subtotals
					for (j = 0; j < 6; j++) {
						subtotalProfits = 0;
						deltaSubtotalProfits = 0;
						subtotalTrades = 0;
						for (k = 0; k < 6; k++) {
							subtotalProfits += stockerModeProfits[j][k][0];
							deltaSubtotalProfits += stockerModeProfits[j][k][1];
							subtotalTrades += stockerModeProfits[j][k][2];
							stockerModeProfits[j][k][1] = 0;
						}
						strProfit = subtotalProfits ? ((100 * subtotalProfits/totalProfits).toFixed(2) + '%').padStart(8) : '';
						strDeltaModeProfits = (deltaSubtotalProfits ? '$' + Beautify(deltaSubtotalProfits, 2) : '').padStart(14);
						strTrades = subtotalTrades ? (' ' + subtotalTrades + ' trade' + (subtotalTrades > 1 ? 's' : ' ')).padStart(13) : '';
						
						console.log(`Subtotal[${j}]`.padEnd(14) + `= $${Beautify(subtotalProfits, 2).padEnd(14)} ${strProfit}${strDeltaModeProfits}${strTrades}`);
						subtotalProfits = 0;
						deltaSubtotalProfits = 0;
						subtotalTrades = 0;
					}
					
					// Stats for totals
					let hourlyProfits = totalProfits * (stockerLoopFrequency / 60_000) * 3600_000 / stockerUptime;
					let dailyProfits = totalProfits * (stockerLoopFrequency / 60_000) * 86_400_000 / stockerUptime;

					if (!stockerForceLoopUpdates) {
						hourlyProfits *= 2;
						dailyProfits *= 2;
					}
					console.log(`Total profits = $${Beautify(totalProfits, 2).padEnd(22)}${(deltaTotalProfits ? '$' + Beautify(deltaTotalProfits, 2) : '').padStart(15)}${totalTrades ? (' ' + totalTrades + ' trade' + (totalTrades > 1 ? 's' : ' ')).padStart(13) : ''}`);
					console.log(`Profit per hour = $${Beautify(hourlyProfits, 2)}; profit per day = $${Beautify(dailyProfits, 2)}`);
					console.log(`That's ${Beautify(hourlyProfits * Game.cookiesPsRawHighest, 2)} cookies and ${Beautify(dailyProfits * Game.cookiesPsRawHighest, 2)} cookies, respectively. It's also ${Beautify((hourlyProfits / 3600), 0)} times your highest raw cookie production rate.`);
					if (stockerForceLoopUpdates) {
						console.log('In unadjusted, true numbers:');
						hourlyProfits *= 60_000 / stockerLoopFrequency;
						dailyProfits *= 60_000 / stockerLoopFrequency;
						console.log(`Profit per hour = $${Beautify(hourlyProfits, 2)}; profit per diem = $${Beautify(dailyProfits, 2)}`);
						console.log(`That's ${Beautify(hourlyProfits * Game.cookiesPsRawHighest, 2)} cookies and ${Beautify(dailyProfits * Game.cookiesPsRawHighest, 2)} cookies, respectively. It's also ${Beautify((hourlyProfits / 3600), 0)} times your highest raw cookie production rate.`);
					}
					console.log('------------------------------------------------------------------');
				}
			},stockerActivityReportFrequency);
		}
	},
});

}
else setTimeout(waitForGame,100)
})
		var stockerStopTrading = false
		
		// Announce transactions in game notifications
		var stockerTransactionNotifications = false

		// Make regular profit reports
		var stockerActivityReport = false
			// How often to make regular reports in ms (one hour by default)
			var stockerActivityReportFrequency = 1000 * 60

		// Make game notifications fade away on their own
		var stockerFastNotifications = false

		// Use console.log for more detailed info on prices and trends
		var stockerConsoleAnnouncements = true

		// Logic loop frequency; do not touch it unless you are cheating
		var stockerLoopFrequency = 1000 * 30

		
		// The cheat itself. Rolls the cycle every time logic loop triggers
		var stockerForceLoopUpdates = false

		var hideBogdanoff = true
		var stockerGreeting = 'click clack you are now in debt'



// ===================================================================================

if(typeof CCSE == undefined)
	Game.LoadMod('https://klattmose.github.io/CookieClicker/SteamMods/CCSE/main.js')

if(CookiStocker === undefined) var CookiStocker = {};

CookiStocker.name = 'CookiStocker';
CookiStocker.version = '2.0';
CookiStocker.GameVersion = '2.052';

if (stockList === undefined) {
	var stockList = {
		check: 'dump eet',
		goods: [],
		sessionStart: Date.now() + 500,
		sessionLastTime: Date.now() + 500,
		startingProfits: 0,
		sessionProfits: 0,
		sessionNetProfits: 0,
		sessionGrossProfits: 0,
		sessionGrossLosses: 0,
		sessionProfitableStocks: 0,
		sessionUnprofitableStocks: 0,
		sessionProfitableTrades: 0,
		sessionUnprofitableTrades: 0,
		sessionPurchases: 0,
		sessionSales: 0,
	}
}

if (!hideBogdanoff) console.log('\n\n⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣼⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣧⡀⠀⠀⠀⠀⠀⠀⠀⠈⠉⠀⠀\n⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀\n⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡆⠀⠀⠀⠀⠀⠀⠀⠀⠀\n⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀⠀⢀⣀⣀⡀\n⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣿⣿⣿⣿⣿⠿⠿⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡆⠀⠀⠀⠀⠈⠛⢿⣷\n⠀⠀⠀⠀⠀⠀⠀⠀⢀⣾⣿⣿⣿⣿⡟⠁⠀⠀⠀⠀⠀⠀⠈⠉⠉⠉⠉⠻⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠃⠀⠀⠀⠀⠀⠀⣸⣿\n⠀⠀⠀⠀⠀⠀⠀⠀⠘⣿⣿⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡄⠀⠀⠀⠀⢠⣾⣿⣿\n⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⡏⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡇⠀⠀⠀⠈⢿⣿⣿⣿\n⠃⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠁⠀⠀⠀⠀⠈⣿⣿⣿\n⠀⢀⠀⢠⠀⠀⠀⠀⠀⢿⣿⣿⣿⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⡈⠻⠟⠛⠛⢿⣿⣿⡿⠇⠀⠀⠀⠀⠀⠀⣿⣿⣿\n⣶⣿⡀⠀⠀⠀⠀⠀⠀⠀⢻⣿⠋⠀⠀⣠⣤⣄⣀⣠⣀⡀⠀⠀⢀⣤⣴⣶⣿⣿⣿⣿⣿⡆⠀⠀⠀⢻⣿⡆⠀⠀⠀⠀⠀⠀⠀⠘⠋⠀\n⣿⣿⣧⠀⠀⠀⠀⠀⠀⠀⠈⠁⠀⠀⠎⢀⣩⡽⣿⣿⣿⡏⠀⠀⠘⣿⣿⠟⠙⠿⠿⠟⠋⠀⠀⠀⠀⢀⣄⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀\n⣿⣿⠉⠀⣠⣤⡀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠉⠀⠈⠉⠉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠁⢀⣤⠄⠀⠀⠀⠀⠀⠸⡷⠀\n⣿⣿⣷⡾⠟⠋⠁⠀⠀⠀⢼⡆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⠀\n⣿⠟⠁⠀⠀⠀⠀⠀⠀⢀⣴⣿⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠐⠾⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠛⠀\n⣿⠀⠀⠀⠀⠀⠀⣰⠀⢸⣿⠛⠉⠂⠀⠀⠀⠀⠀⠀⠀⠶⠤⣴⣶⠾⠟⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀\n⠏⠀⠀⠐⡫⢀⣾⡇⠀⠈⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀\n⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣠⣴⣶⠀⠀⠄⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣠⣀⣀⣠⣤⣄⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀\n⠀⠀⠀⠀⠀⣠⣴⠀⠹⡇⢿⣿⠃⠀⠀⠐⡀⠀⢠⣴⠶⠿⠿⠿⠿⠿⠟⢛⡿⠿⣿⣿⣿⣄⠀⡆⠀⠸⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀\n⠀⠀⠀⠠⢾⣿⣟⣠⢉⣥⣼⡏⠀⠀⠀⠀⠘⣶⠁⠀⠀⢤⣤⣠⣤⣤⣶⡿⠃⠀⠹⣿⣿⣷⣾⠁⠀⠀⠀⣷⡀⠀⠀⠀⠀⠀⠀⠀⠀\n⠀⠀⠀⣠⣾⣿⣿⣿⣿⣿⡟⠀⠀⠀⠀⠀⠀⠘⣆⠀⠀⠀⠉⠛⠛⠛⠉⠀⠀⠀⢀⣿⣿⡟⠁⠀⠀⠀⠀⣰⣿⣷⣄⠀⠀⠀⠀⠀⠀⠀\n⠀⠀⠀⠐⢿⠟⠋⠙⠻⣿⣃⣀⣀⣤⣤⣶⣾⣿⠁⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣼⠟⠉⠀⠀⠀⠀⠀⣴⣿⣿⣿⣿⣦⡀⠀⠀⠀⠀⠀\n⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣿⣿⣿⣿⣿⣿⣿⡆⠸⣦⣤⣄⣀⣀⣠⣤⣤⣴⠎⠀⠀⠀⠀⠀⠀⢀⣼⣿⣿⣿⣿⣿⣿⣿⣶⣤⣤⣄⣀\n⠀⠀⠀⠀⠀⠀⠀⠀⣰⣿⣿⣿⣿⣿⣿⣿⣿⣿⡇⠀⠹⣏⠛⠛⠛⠛⠛⠉⠁⠀⠀⠀⠀⠀⠀⢠⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿\n⠀⠀⠀⢀⠀⢀⣤⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡇⠀⠀⠙⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣴⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿\n\n     wot iz he doing in ze console?\n\n\n');

var modeDecoder = ['stable','slowly rising','slowly falling','rapidly rising','rapidly falling','fluctuating'] // meanings of each market trend (good.mode)
var goodIcons = [[2,33],[3,33],[4,33],[15,33],[16,33],[17,33],[5,33],[6,33],[7,33],[8,33],[13,33],[14,33],[19,33],[20,33],[32,33],[33,33],[34,33],[35,33]];

CookiStocker.launch = function() {
	isLoaded = 1;
}

if (!CookiStocker.isLoaded){
	if (CCSE && CCSE.isLoaded) {
		CookiStocker.launch();
	}
	else {
		if(!CCSE) var CCSE = {};
		if(!CCSE.postLoadHooks) CCSE.postLoadHooks = [];
		CCSE.postLoadHooks.push(CookiStocker.launch);
	}
}
/*
CookiStocker.optionsMenu = function(){
	var hStr = ' '<div class="listing">' + CCSE.MenuHelper.ActionButton("", "Unlock Hardcore Achievement") + '</div>';
}
*/
function stockerTimeBeautifier(duration) {
	var milliseconds = Math.floor((duration % 1000) / 100),
	  seconds = Math.floor((duration / 1000) % 60),
	  minutes = Math.floor((duration / (1000 * 60)) % 60),
	  hours = Math.floor((duration / (1000 * 60 * 60)) % 24),
	  days = Math.floor(duration / (1000 * 60 * 60 * 24));
	if (seconds && (minutes || hours || days) && !stockerForceLoopUpdates)
		seconds = 0;						// Don't display
	var strSeconds = seconds + ' second' + (seconds != 1 ? 's' : '');
	var strMinutes = minutes ? minutes + ' minute' + (minutes != 1 ? 's' : '') + (seconds ? (hours || days ? ', and ' : ' and ') : '') : '';
	var strHours = hours ? hours + ' hour' + (hours != 1 ? 's' : '') + (minutes && seconds ? ', ' : ((minutes ? !seconds : seconds) ? ' and ' : '')) : '';
	var strDays = days ? days + ' day' + (days != 1 ? 's' : '') + (hours && minutes || hours && seconds || minutes && seconds ? ', ' : (((hours ? !minutes : minutes) ? !seconds : seconds) ? ' and ' : '')) : '';
	var strTime = strDays + strHours + strMinutes;
	if (stockerForceLoopUpdates && seconds)
		strTime += strSeconds; 
	if (minutes || hours || days) {
		return (strTime);
	} else
		return (strSeconds);
}

setTimeout(function waitForGame() {
	if (typeof Game === 'object' && Game.ready) {
	

Game.registerMod('CookiStocker',{
	init:function(){

		this.startStocking();
	},
	startStocking:function(){
		if (!Game.Objects['Bank'].minigame) {
			console.log('=====$$$=== Stock Market minigame has not initialised yet! Will try again in 500 ms.');
			setTimeout(() => {
				this.startStocking();
			},500);
			return
		}
		else {
			console.log('=====$$$=== CookiStocker logic loop initialised at ' + new Date());
			console.log('=====$$$=== With main options as follows:')
			console.log('=====$$$=== Logic loop frequency: ' + stockerTimeBeautifier(stockerLoopFrequency))
			console.log('=====$$$=== Report frequency: ' + stockerTimeBeautifier(stockerActivityReportFrequency))
			console.log('=====$$$=== Cheating: ' + stockerForceLoopUpdates)
			Game.Notify('CookiStocker is ready',stockerGreeting,[1,33],false);
			console.log(stockList.check);
		}
		
		var market = Game.Objects['Bank'].minigame.goodsById;	// read market
		console.log('Reading the market:');
		stockList.startingProfits = Game.Objects['Bank'].minigame.profit;
		for (let i = 0; i < market.length; i++){
			stockList.goods.push({
		 		name: market[i].name,
		 		stock: market[i].stock,
		 		currentPrice: market[i].val,
				mode: market[i].mode,
				lastMode: market[i].mode,
				lastDur: market[i].dur,
				unchangedDur: 0,
				dropCount: 0,
				riseCount: 0,
				profit: 0,
				someSold: false,
				someBought: false,
			});
			console.log('Stock: ' + market[i].name.replace('%1', Game.bakeryName) + ' Status: ' + modeDecoder[market[i].mode] + ' at $' + market[i].val + (market[i].stock ? ' (own)' : ''));
		}
		if (stockerForceLoopUpdates)
			Game.Objects['Bank'].minigame.secondsPerTick = stockerLoopFrequency / 1000;
		var stockerLoop = setInterval(function() {
			let doUpdate = false;
			
			// setting stockerForceLoopUpdates to true will make the logic loop force the market to tick every time it triggers,
			// making this an obvious cheat, and i will personally resent you.
			
			// but
			// if you backup your save and set stockerLoopFrequency to like 10 milliseconds it looks very fun and effective.
			// yes, this is how i made the gif on the steam guide page.
			if (!stockerForceLoopUpdates)
				stockerLoopFrequency = Game.Objects['Bank'].minigame.secondsPerTick * 500;		// Keep up to date
			const smallDelta = 3;
			const largeDelta = 4;
			const alwaysBuyBelow = 2;
			const neverSellBelow = 11;

			market = Game.Objects['Bank'].minigame.goodsById;	// update market
			for (let i = 0; i < market.length; i++) {
				
				let lastPrice = stockList.goods[i].currentPrice;
				let currentPrice = market[i].val;

				// update stockList
				stockList.goods[i].stock = market[i].stock;
				stockList.goods[i].currentPrice = market[i].val;
				stockList.goods[i].mode = market[i].mode;

				let md = stockList.goods[i].mode;
				let lmd = stockList.goods[i].lastMode;
				let lastStock = market[i].stock;
				let deltaPrice = largeDelta;
				let stockName = stockList.goods[i].name.replace('%1', Game.bakeryName);
				
				// Our ceilingPrice is the maximum of the bank ceiling and the (deprecated but still useful) stock ceiling
				let ceilingPrice = Math.max(10*(i+1) + Game.Objects['Bank'].level + 49, 97 + Game.Objects['Bank'].level * 3);

				if (Game.ObjectsById[i+2].amount == 0) {		// stock must be active
					console.log(`${stockName} stock is inactive`);
					continue;
				}
				if (lmd == md && (stockList.goods[i].stock && (md == 2 || md == 4) ||	// Make selling into a downturn easier
				!stockList.goods[i].stock && (md == 1 || md == 3)))			// Make buying into an upturn easier
					deltaPrice = smallDelta;
				if (md != lmd && (md == 3 && lmd != 1 || md == 4 && lmd != 2 || md == 1 && lmd != 3 || md == 2 && lmd != 4)) {
					stockList.goods[i].dropCount = 0;
					stockList.goods[i].riseCount = 0;
				} else if (currentPrice > lastPrice) {
					stockList.goods[i].dropCount = 0;
					stockList.goods[i].riseCount++;
				} else if (currentPrice < lastPrice) {
					stockList.goods[i].riseCount = 0;
					stockList.goods[i].dropCount++;
				}
				if (stockList.goods[i].lastDur != market[i].dur || ++stockList.goods[i].unchangedDur > 1) {
					stockList.goods[i].unchangedDur = 0;
					doUpdate = true;
				}
				if (stockerConsoleAnnouncements && doUpdate) {			// Tick tick
					if (md == lmd)
						console.log(`${stockName} mode is unchanged at ${lmd} [${modeDecoder[lmd]}] at $${Beautify(currentPrice, 2)}`);
					else
						console.log(`MODE CHANGE ${stockName} old mode was ${lmd} [${modeDecoder[lmd]}] and new mode is ${md} [${modeDecoder[md]}] at $${Beautify(currentPrice, 2)}`);
				}
				stockList.goods[i].lastDur = market[i].dur;
				if (	// buy conditions
					(
						currentPrice < alwaysBuyBelow || md != 4 && ((currentPrice > lastPrice &&
						stockList.goods[i].riseCount >= deltaPrice || (md == 1 || md == 3) && md != lmd || 
						md == 0 && !stockList.goods[i].someSold && stockList.goods[i].dropCount < deltaPrice &&
						currentPrice >= 10) && (currentPrice < ceilingPrice || md == 1 || md == 3))
					)
					&& Game.Objects['Bank'].minigame.buyGood(i,10000) 	// actual buy attempt
				)
				{
					// buying
					let mode = (lmd != md) ? 'is no longer in ' + modeDecoder[lmd] + ' mode' : 'is ';
					let units = market[i].stock - lastStock;

					stockList.goods[i].someBought = true;
					stockList.goods[i].stock = market[i].stock;
					if (market[i].prevBuyMode1 != undefined)
					{
						market[i].prevBuyMode1 = lmd;
						market[i].prevBuyMode2 = md;
					}
					market[i].buyTime = Date.now();
					if (typeof StockAssistant != 'undefined')
					{
						StockAssistant.stockData.goods[i].boughtVal = market[i].prev;
						StockAssistant.buyGood(i);
					}
					stockList.sessionPurchases++;
					if (stockerTransactionNotifications)
						if (currentPrice >= 2) Game.Notify(`Buying ${stockName} ${new Date().toLocaleTimeString([], {hourCycle: 'h23', hour: '2-digit', minute: '2-digit'})}`,`Buying ${units} unit${(units > 1 ? 's' : '')}. The stock ${mode} at $${Beautify(market[i].prev, 2)} per unit (your buying price) and is in ${modeDecoder[md]} mode now.`,goodIcons[i],stockerFastNotifications);
						else Game.Notify(`Buying ${stockName} ${new Date().toLocaleTimeString([], {hourCycle: 'h23', hour: '2-digit', minute: '2-digit'})}`, `Buying ${units} unit${(units > 1 ? 's' : '')}. The price has dropped below $2 per unit, and your buying price is $${Beautify(market[i].prev, 2)}.`,goodIcons[i],stockerFastNotifications);
					if (stockerConsoleAnnouncements) console.log('=====$$$=== Buying '+ stockName + ' at $' + Beautify(market[i].prev, 2));
				} else if (	// sell conditions
					stockList.goods[i].stock > 0 && (currentPrice < lastPrice &&
					stockList.goods[i].dropCount >= deltaPrice ||
					(md == 2 || md == 4) && md != lmd) && currentPrice >= neverSellBelow	// not near the bottom
				)
				{
					// selling
					let profit = 0;
					let strProfit = 'profit '
					let mode = (lmd != md) ? 'is no longer in ' + modeDecoder[lmd] + ' mode and ' : '';

					if (!Game.Objects['Bank'].minigame.sellGood(i,stockList.goods[i].stock)) {
						stockList.goods[i].lastMode = stockList.goods[i].mode	// update last mode
						continue;
					}
					stockList.goods[i].someSold = true;
					market[i].prevSale = market[i].val;
					market[i].prevSellMode1 = lmd;
					market[i].prevSellMode2 = md;
					market[i].sellTime = Date.now();
					if (typeof StockAssistant != 'undefined')
						StockAssistant.sellGood(i);
					stockList.sessionSales++;
					profit = (market[i].val - market[i].prev) * stockList.goods[i].stock;
					stockList.goods[i].profit += profit;
					if (profit > 0) {
						stockList.sessionGrossProfits += profit;
						stockList.sessionProfitableTrades++;
					} else {
						stockList.sessionGrossLosses += -profit;
						stockList.sessionUnprofitableTrades++;
					}
					stockList.sessionNetProfits += profit;
					stockerModeProfits[lmd][md][0] += profit;
					stockerModeProfits[lmd][md][1] += profit;
					stockerModeProfits[lmd][md][2]++;
					if (profit < 0)
					{
						strProfit = 'loss ';
						profit = -profit;
					}
					if (stockerTransactionNotifications) Game.Notify(`Selling ${stockName} ${new Date().toLocaleTimeString([], {hourCycle: 'h23', hour: '2-digit', minute: '2-digit'})}`,`Selling ${stockList.goods[i].stock} unit${(stockList.goods[i].stock > 1 ? 's' : '')} at a price of $${Beautify(market[i].val, 2)} per unit for a ${strProfit} of $${Beautify(profit, 2)} and total revenue of $${Beautify(market[i].val*stockList.goods[i].stock, 2)}, which is added to the total market profits. The stock ${mode} is in ${modeDecoder[md]} mode now. Bought at a price of $${Beautify(market[i].prev, 2)} per unit.`,goodIcons[i],stockerFastNotifications);
					if (stockerConsoleAnnouncements) console.log(`=====$$$=== Selling ${stockName} at $${Beautify(market[i].val, 2)} for a ${strProfit}of $${Beautify(profit, 2)} and total revenue of $${Beautify(market[i].val*stockList.goods[i].stock, 2)}. Last bought at $${Beautify(market[i].prev, 2)}.`);
				}
				
				stockList.sessionProfits = Game.Objects['Bank'].minigame.profit - stockList.startingProfits;
				stockList.goods[i].lastMode = stockList.goods[i].mode	// update last mode
			}
			stockList.sessionProfitableStocks = stockList.sessionUnprofitableStocks = 0;
			for (let i = 0; i < market.length; i++) {			// Must recalculate the whole list on every pass
				if (stockList.goods[i].profit > 0)
					stockList.sessionProfitableStocks++;
				else if (stockList.goods[i].profit < 0)
					stockList.sessionUnprofitableStocks++;
			}
		},stockerLoopFrequency);
		
		let stockerModeProfits = [
			[[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
			[[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
			[[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
			[[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
			[[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
			[[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]
		];

		if (stockerActivityReport || stockerConsoleAnnouncements) {
			var stockerReportInterval = setInterval(function() {
				let now = Date.now();
				if (now > stockList.sessionLastTime + stockerActivityReportFrequency + 500) {		// Were we sleeping?
					stockList.sessionStart += now - stockList.sessionLastTime - stockerActivityReportFrequency;
				}

				var stockerUptime = Math.floor((now - stockList.sessionStart) / 1000) * 1000;
				var totalStocks = 0;
				var totalShares = 0;
				var totalValue = 0;
				var unrealizedProfits = 0;
				let j, k;

				stockList.sessionLastTime = now;
				stockerUptime -= stockerUptime % stockerLoopFrequency;
				if (stockerActivityReport)
					if ((stockList.sessionPurchases + stockList.sessionSales) == 0) {
						Game.Notify(
							`CookiStocker report ${new Date().toLocaleTimeString([], {hourCycle: 'h23', hour: '2-digit', minute: '2-digit'})}`,
							`This session has been running for ${stockerTimeBeautifier(stockerUptime)}, but no good investment opportunities were detected! Luck is not on our side, yet.`
							,[1, 33],stockerFastNotifications
						);
					} else {
						Game.Notify(
							`CookiStocker report ${new Date().toLocaleTimeString([], {hourCycle: 'h23', hour: '2-digit', minute: '2-digit'})}`,
							`This session has been running for ${stockerTimeBeautifier(stockerUptime)} and has made $${Beautify(stockList.sessionNetProfits, 0)} in net profits and $${Beautify(stockList.sessionProfits, 0)} in revenue (displayed profits) in ${Beautify(stockList.sessionPurchases, 0)} purchases and ${Beautify(stockList.sessionSales, 0)} sales.`,[1, 33],stockerFastNotifications
						);
					}
				if (stockerConsoleAnnouncements) {
					let totalProfits = 0;
					let subtotalProfits = 0;
					let deltaTotalProfits = 0;
					let deltaSubtotalProfits = 0;
					let totalTrades = 0;
					let subtotalTrades = 0;
					let profit = 0;
					let lastProfit = 0;
					let trades = 0;
					let strProfit = '';
					let strDeltaModeProfits = '';
					let strTrades = '';

					for (j = 0; j < market.length; j++) {
						if (stockList.goods[j].stock) {
							totalStocks++;
							totalShares += stockList.goods[j].stock;
							totalValue += stockList.goods[j].stock * stockList.goods[j].currentPrice;
							unrealizedProfits += (market[j].val - market[j].prev) * stockList.goods[j].stock;
						}
					}
					console.log(`Running for ${stockerTimeBeautifier(stockerUptime)} and made $${Beautify(stockList.sessionNetProfits, 0)}\n  in net profits and $${Beautify(stockList.sessionProfits, 0)} in revenue (displayed profits)\n  in ${Beautify(stockList.sessionPurchases, 0)} purchases and ${Beautify(stockList.sessionSales, 0)} sales.\nTotal number of stocks held: ${totalStocks}.  Total shares: ${Beautify(totalShares, 0)}.\nTotal value: $${Beautify(totalValue)}.  Unrealized profits: $${Beautify(unrealizedProfits, 2)}.\nTotal gross profits:  $${Beautify(stockList.sessionGrossProfits, 0)}.  Profitable stocks:  ${stockList.sessionProfitableStocks}.\nProfitable trades:  ${stockList.sessionProfitableTrades}.  Average profit per trade:  $${stockList.sessionGrossProfits ? Beautify(stockList.sessionGrossProfits / stockList.sessionProfitableTrades, 2) : 0}.\nTotal gross losses:  $${Beautify(stockList.sessionGrossLosses, 0)}.  Unprofitable stocks:  ${stockList.sessionUnprofitableStocks}.\nUnprofitable trades:  ${stockList.sessionUnprofitableTrades}.  Average loss per trade:  $${stockList.sessionGrossLosses ? Beautify(stockList.sessionGrossLosses / stockList.sessionUnprofitableTrades, 2) : 0}.`);
					
					// Stats for individual modes
					for (j = 0; j < 6; j++)
						for (k = 0; k < 6; k++)
							totalProfits += stockerModeProfits[j][k][0];
					for (j = 0; j < 6; j++)
						for (k = 0; k < 6; k++) {
							profit = stockerModeProfits[j][k][0];
							lastProfit = stockerModeProfits[j][k][1];
							trades = stockerModeProfits[j][k][2];
							strProfit = profit ? ((100 * profit/totalProfits).toFixed(2) + '%').padStart(8) : '';
							strDeltaModeProfits = (lastProfit ? '$' + Beautify(lastProfit, 2) : '').padStart(14);
							strTrades = trades ? (' ' + trades + ' trade' + (trades > 1 ? 's' : ' ')).padStart(13) : '';
							
							console.log(`Profits[${j}][${k}] = $${Beautify(profit, 2).padEnd(14)} ${strProfit}${strDeltaModeProfits}${strTrades}`);
							subtotalProfits += profit;
							deltaSubtotalProfits += lastProfit;
							deltaTotalProfits += lastProfit;
							subtotalTrades += trades;
							totalTrades += trades;
						}
						
					// Stats for subtotals
					for (j = 0; j < 6; j++) {
						subtotalProfits = 0;
						deltaSubtotalProfits = 0;
						subtotalTrades = 0;
						for (k = 0; k < 6; k++) {
							subtotalProfits += stockerModeProfits[j][k][0];
							deltaSubtotalProfits += stockerModeProfits[j][k][1];
							subtotalTrades += stockerModeProfits[j][k][2];
							stockerModeProfits[j][k][1] = 0;
						}
						strProfit = subtotalProfits ? ((100 * subtotalProfits/totalProfits).toFixed(2) + '%').padStart(8) : '';
						strDeltaModeProfits = (deltaSubtotalProfits ? '$' + Beautify(deltaSubtotalProfits, 2) : '').padStart(14);
						strTrades = subtotalTrades ? (' ' + subtotalTrades + ' trade' + (subtotalTrades > 1 ? 's' : ' ')).padStart(13) : '';
						
						console.log(`Subtotal[${j}]`.padEnd(14) + `= $${Beautify(subtotalProfits, 2).padEnd(14)} ${strProfit}${strDeltaModeProfits}${strTrades}`);
						subtotalProfits = 0;
						deltaSubtotalProfits = 0;
						subtotalTrades = 0;
					}
					
					// Stats for totals
					let hourlyProfits = totalProfits * (stockerLoopFrequency / 60_000) * 3600_000 / stockerUptime;
					let dailyProfits = totalProfits * (stockerLoopFrequency / 60_000) * 86_400_000 / stockerUptime;

					if (!stockerForceLoopUpdates) {
						hourlyProfits *= 2;
						dailyProfits *= 2;
					}
					console.log(`Total profits = $${Beautify(totalProfits, 2).padEnd(22)}${(deltaTotalProfits ? '$' + Beautify(deltaTotalProfits, 2) : '').padStart(15)}${totalTrades ? (' ' + totalTrades + ' trade' + (totalTrades > 1 ? 's' : ' ')).padStart(13) : ''}`);
					console.log(`Profit per hour = $${Beautify(hourlyProfits, 2)}; profit per day = $${Beautify(dailyProfits, 2)}`);
					console.log(`That's ${Beautify(hourlyProfits * Game.cookiesPsRawHighest, 2)} cookies and ${Beautify(dailyProfits * Game.cookiesPsRawHighest, 2)} cookies, respectively. It's also ${Beautify((hourlyProfits / 3600), 0)} times your highest raw cookie production rate.`);
					if (stockerForceLoopUpdates) {
						console.log('In unadjusted, true numbers:');
						hourlyProfits *= 60_000 / stockerLoopFrequency;
						dailyProfits *= 60_000 / stockerLoopFrequency;
						console.log(`Profit per hour = $${Beautify(hourlyProfits, 2)}; profit per diem = $${Beautify(dailyProfits, 2)}`);
						console.log(`That's ${Beautify(hourlyProfits * Game.cookiesPsRawHighest, 2)} cookies and ${Beautify(dailyProfits * Game.cookiesPsRawHighest, 2)} cookies, respectively. It's also ${Beautify((hourlyProfits / 3600), 0)} times your highest raw cookie production rate.`);
					}
					console.log('------------------------------------------------------------------');
				}
			},stockerActivityReportFrequency);
		}
	},
});

}
else setTimeout(waitForGame,100)
})
