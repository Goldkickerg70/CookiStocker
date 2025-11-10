/* CookiStocker — unified, defensive build
 * Version: 3.0.3
 * Game target: 2.053
 * Build: 2025-11-10
 */

/* ===================== Options (user-editable) ===================== */

var stockerAutoTrading = true;                 // Automatic trading when true
var stockerMarketOn = true;                    // Stock market is running when true
var stockerMinBrokers = 72;                    // Minimum brokers (72 ≈ 0.5% commission)
var stockerCookiesThreshold = 0.05;            // Fraction of banked cookies allowed per auto-trade
var stockerAutoBuyMinimumBrokers = true;       // Buy up to minimum brokers automatically
var stockerAutoBuyAdditionalBrokers = true;    // Buy additional brokers automatically
var stockerExponential = true;                 // Exponential warehouses
var stockerExponentialPower = 1.0;             // Power used when Exponential is on
var stockerTransactionNotifications = true;    // Game.Notify for buys/sells
var stockerActivityReport = false;             // Periodic reports
var stockerActivityReportFrequency = 1000 * 60 * 60; // Default 1 hour
var stockerFastNotifications = false;          // Notify fade quickly
var stockerConsoleAnnouncements = false;       // Verbose console logging
var stockerResourcesWarning = true;            // Show resource warnings in UI
var stockerAdditionalTradingStats = true;      // Extra stats block in UI
var stockerLoopFrequency = 1000 * 30;          // Logic loop tick (ms)
var stockerForceLoopUpdates = false;           // Cheat: force a market tick every loop
var stockerGreeting = 'click clack you will soon be in debt';

/* ===================== Constants ===================== */

const CS_TEN_YEARS = 86400 * 365.25 * 10;      // seconds
const CS_GASEOUS_PROFITS = 31536000;           // $31,536,000
const CS_PLASMIC_PROFITS = 100000000;          // $100,000,000
const CS_BOSE_EINSTEIN_PROFITS = 500000000;    // $500,000,000

/* ===================== CCSE bootstrap ===================== */

if (typeof CCSE === 'undefined')
    Game.LoadMod('https://klattmose.github.io/CookieClicker/SteamMods/CCSE/main.js');

/* ===================== Root namespace ===================== */

if (typeof CookiStocker === 'undefined') window.CookiStocker = {};
CookiStocker.name = 'CookiStocker';
CookiStocker.version = '3.0.3';
CookiStocker.GameVersion = '2.053';
CookiStocker.build = 'Mon 2025-11-10';

/* One-shot flags & timers */
CookiStocker.isLoaded = 0;
CookiStocker._tickHookInstalled = 0;
CookiStocker._tickTimeout = 0;
CookiStocker._reportTimeout = 0;
CookiStocker._loopTimer = 0;
CookiStocker.reportTimer = 0;
CookiStocker._reportEveryMs = 0;

/* State handles */
CookiStocker.Bank = 0;
CookiStocker._origGetGoodMaxStock = null;   // safe chained original
CookiStocker._wrappedGetSignature = '__CookiStockerWrapped__';

/* ===================== Utility ===================== */

function l(id){ return document.getElementById(id); } // game defines this, but guard if needed

function ensureStockerStyles(){
    if (document.getElementById('stocker-styles')) return;
    const style = document.createElement('style');
    style.id = 'stocker-styles';
    style.textContent = `
    .stocker-stats{display:flex;flex-wrap:wrap;justify-content:center;align-items:baseline;gap:0 3px;white-space:normal}
    .stocker-stats .stat{white-space:nowrap;font-size:10px;color:rgba(255,255,255,.8);padding:1px 3px}
    .stocker-stats .break{flex-basis:100%;height:0}
    @media (min-width:950px){.stocker-stats .break{display:none}}
    .green{color:#8f8}
    `;
    document.head.appendChild(style);
}

/* humanized duration for reports */
function stockerTimeBeautifier(duration){
    var milliseconds = Math.floor(duration % 1000),
        seconds = Math.floor((duration / 1000) % 60),
        minutes = Math.floor((duration / (1000*60)) % 60),
        hours   = Math.floor((duration / (1000*60*60)) % 24),
        days    = Math.floor(duration / (1000*60*60*24));
    if (seconds && (minutes||hours||days) && !stockerForceLoopUpdates) seconds = 0;
    var s  = seconds + ' second' + (seconds!=1?'s':'');
    var m  = minutes ? minutes + ' minute' + (minutes!=1?'s':'') + (seconds?(hours||days?', and ':' and '):'') : '';
    var h  = hours ? hours + ' hour' + (hours!=1?'s':'') + (minutes&&seconds?', ':((minutes?!seconds:seconds)?' and ':'')) : '';
    var d  = days ? days + ' day' + (days!=1?'s':'') + ( (hours&&minutes)||(hours&&seconds)||(minutes&&seconds) ? ', ' : (((hours?!minutes:minutes)?!seconds:seconds)?' and ':'')) : '';
    var out = d + h + m;
    if (stockerForceLoopUpdates && seconds) out += s;
    return (minutes||hours||days) ? out : s;
}

/* ===================== Stock list ===================== */

if (typeof CookiStocker.stockList === 'undefined') CookiStocker.stockList = {};
var stockList = CookiStocker.stockList;

Object.assign(stockList, {
    Check: 1,
    Goods: [],
    Start: Date.now()+500,
    lastTime: Date.now()+500,
    startingProfits: 0,
    Profits: 0,
    netProfits: 0,
    grossProfits: 0,
    grossLosses: 0,
    totalStocks: 0,
    totalShares: 0,
    totalValue: 0,
    unrealizedProfits: 0,
    profitableStocks: 0,
    unprofitableStocks: 0,
    profitableTrades: 0,
    unprofitableTrades: 0,
    Purchases: 0,
    Sales: 0,
    Uptime: 0,
    hourlyProfits: 0,
    dailyProfits: 0,
    minCookies: Number.MAX_VALUE,
    maxCookies: 0,
    noModActions: false,
    origCookiesPsRawHighest: 0,
    Amount: 0,
    canBuy: true,
    shadowGone: false,
});

let stockerModeProfits = Array.from({length:6},()=>Array.from({length:6},()=>[0,0,0]));
var modeDecoder = ['stable','slowly rising','slowly falling','rapidly rising','rapidly falling','chaotic'];
var goodIcons = [[2,33],[3,33],[4,33],[15,33],[16,33],[17,33],[5,33],[6,33],[7,33],[8,33],[13,33],[14,33],[19,33],[20,33],[32,33],[33,33],[34,33],[35,33]];

/* ===================== UI helpers ===================== */

CookiStocker.extraStatsId = 'stockerExtra';

CookiStocker.buildExtraStatsHTML = function(){
    return `
    <div class="stocker-stats">
      <span class="stat">Net cookies won: <span id="netCookies">0</span>.</span>
      <span class="stat">Cookies per hour: <span id="cookiesHour">0</span>.</span>
      <span class="stat">Cookies per day: <span id="cookiesDay">0</span>.</span>
      <span class="stat">Purchases: <span id="Purchases">0</span>.</span>
      <span class="stat">Sales: <span id="Sales">0</span>.</span>
    </div>
    <div class="stocker-stats">
      <span class="stat">CPS multiple: <span id="cpsMultiple">0</span>.</span>
      <span class="stat">Stocks held: <span id="stocksHeld">${stockList.totalStocks}</span>.</span>
      <span class="stat">Total shares: <span id="totalShares">0</span>.</span>
      <span class="stat">Total value: <span id="totalValue">0</span>.</span>
      <span class="stat">Unrealized profits: <span id="unrealizedProfits">0</span>.</span>
    </div>
    <div class="stocker-stats">
      <span class="stat">Profitable stocks: <span id="profitableStocks">0</span>.</span>
      <span class="stat">Unprofitable stocks: <span id="unprofitableStocks">0</span>.</span>
      <span class="stat">Profitable trades: <span id="profitableTrades">0</span>.</span>
      <span class="stat">Unprofitable trades: <span id="unprofitableTrades">0</span>.</span>
      <span class="break"></span>
      <span class="stat">Average profit per trade: <span id="averageProfit">$0</span>.</span>
      <span class="stat">Average loss per trade: <span id="averageLoss">$0</span>.</span>
    </div>`;
};

CookiStocker.updateAdditionalStatsVisibility = function(){
    const header = l('bankHeader');
    const host = header && header.firstChild ? header.firstChild : null;
    if (!host) return;
    let extra = l(CookiStocker.extraStatsId);
    if (stockerAdditionalTradingStats){
        if (!extra){
            extra = document.createElement('div');
            extra.id = CookiStocker.extraStatsId;
            extra.innerHTML = CookiStocker.buildExtraStatsHTML();
            host.appendChild(extra);
        }
        extra.style.display = '';
    } else if (extra) {
        extra.style.display = 'none';
    }
};

/* ===================== CCSE Menu ===================== */

CookiStocker.esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,'&#39;').replace(/"/g,'&quot;');
CookiStocker.docs = {
    stockerAutoTrading: "Automatic trading when on",
    stockerMarketOn: "Stock market is running when on",
    stockerMinBrokers: "Minimum number of brokers required for automatic trading",
    stockerCookiesThreshold: "Percentage of banked cookies allowed for a single automatic trade",
    stockerAutoBuyMinimumBrokers: "Buy all necessary brokers as soon as you can afford them",
    stockerResourcesWarning: "Display warning when market conditions and/or options do not permit auto trading",
    stockerExponential: "Increases number of warehouses in sync with the highest raw CPS during this session",
    stockerExponentialPower: "The ratio of the highest raw CPS to the original raw CPS is raised to this power when Exponential Warehouses is on",
    stockerTransactionNotifications: "Announce transactions in game notifications",
    stockerActivityReport: "Make regular profit reports",
    stockerActivityReportFrequency: "How often to make regular reports (minutes and seconds)",
    stockerFastNotifications: "Make game notifications fade away on their own after 6 seconds",
    stockerConsoleAnnouncements: "Use console.log for more detailed info on prices and trends",
    stockerAdditionalTradingStats: "Display more detailed trading info near the top of the stock market display",
    stockerLoopFrequency: "Logic loop frequency (seconds) — CHEAT",
    stockerForceLoopUpdates: "The cheat itself. Rolls the cycle every time logic loop triggers — CHEAT",
    stockerAutoBuyAdditionalBrokers: "Buy additional brokers as soon as you can afford them",
};
CookiStocker.note = function(key, cheat){
    const t = CookiStocker.esc(CookiStocker.docs[key]||"");
    return t ? (' <span class="smallLabel" style="color:'+(cheat?'#ff3705':'rgba(255,255,255,0.65)')+'">'+t+'</span>') : '';
};
CookiStocker.calcCommission = function(n){
    const rate = 0.20 * Math.pow(0.95, Math.max(0, Math.min(162, +n||0)));
    return (rate*100).toFixed(3) + "%";
};

CookiStocker.state = {
    stockerAutoTrading:+!!stockerAutoTrading,
    stockerMarketOn:+!!stockerMarketOn,
    stockerAutoBuyMinimumBrokers:+!!stockerAutoBuyMinimumBrokers,
    stockerAutoBuyAdditionalBrokers:+!!stockerAutoBuyAdditionalBrokers,
    stockerResourcesWarning:+!!stockerResourcesWarning,
    stockerExponential:+!!stockerExponential,
    stockerTransactionNotifications:+!!stockerTransactionNotifications,
    stockerActivityReport:+!!stockerActivityReport,
    stockerFastNotifications:+!!stockerFastNotifications,
    stockerConsoleAnnouncements:+!!stockerConsoleAnnouncements,
    stockerAdditionalTradingStats:+!!stockerAdditionalTradingStats,
    stockerForceLoopUpdates:+!!stockerForceLoopUpdates,
};

CookiStocker.Toggle = function(prefName, button, on, off, invert){
    CookiStocker.state[prefName] = CookiStocker.state[prefName] ? 0 : 1;
    var b = l(button); if (b){ b.innerHTML = CookiStocker.state[prefName] ? on : off; b.className = 'smallFancyButton prefButton option' + ((CookiStocker.state[prefName]^invert)?'':' off'); }
    switch(prefName){
        case 'stockerAutoTrading': stockerAutoTrading = !!CookiStocker.state[prefName]; CookiStocker.updateWarn(); break;
        case 'stockerMarketOn': stockerMarketOn = !!CookiStocker.state[prefName]; CookiStocker.updateWarn(); CookiStocker.ensureReportTimer(); break;
        case 'stockerAutoBuyMinimumBrokers': stockerAutoBuyMinimumBrokers = !!CookiStocker.state[prefName]; CookiStocker.TradingStats(); break;
        case 'stockerAutoBuyAdditionalBrokers': stockerAutoBuyAdditionalBrokers = !!CookiStocker.state[prefName]; CookiStocker.TradingStats(); break;
        case 'stockerResourcesWarning': stockerResourcesWarning = !!CookiStocker.state[prefName]; CookiStocker.updateWarn(); break;
        case 'stockerExponential': stockerExponential = !!CookiStocker.state[prefName]; break;
        case 'stockerTransactionNotifications': stockerTransactionNotifications = !!CookiStocker.state[prefName]; break;
        case 'stockerActivityReport': stockerActivityReport = !!CookiStocker.state[prefName]; CookiStocker.ensureReportTimer(); break;
        case 'stockerFastNotifications': stockerFastNotifications = !!CookiStocker.state[prefName]; break;
        case 'stockerConsoleAnnouncements': stockerConsoleAnnouncements = !!CookiStocker.state[prefName]; CookiStocker.ensureReportTimer(); break;
        case 'stockerAdditionalTradingStats': stockerAdditionalTradingStats = !!CookiStocker.state[prefName]; CookiStocker.updateAdditionalStatsVisibility(); break;
        case 'stockerForceLoopUpdates': stockerForceLoopUpdates = !!CookiStocker.state[prefName]; break;
    }
    PlaySound('snd/tick.mp3');
    Game.UpdateMenu();
};

CookiStocker.ChangeTime = function(prefName, minId, secId){
    let mins = Math.max(0, Math.floor(+l(minId).value||0));
    let secs = Math.max(0, Math.min(59, Math.floor(+l(secId).value||0)));
    let ms = (mins*60+secs)*1000;
    switch(prefName){
        case 'stockerActivityReportFrequency':
            stockerActivityReportFrequency = Math.max(1000, ms||3600000);
            if (CookiStocker.reportTimer){ clearInterval(CookiStocker.reportTimer); CookiStocker.reportTimer=0; }
            CookiStocker.ensureReportTimer();
            break;
        case 'stockerLoopFrequency':
            stockerLoopFrequency = Math.max(1000, ms||30000);
            if (stockerForceLoopUpdates && CookiStocker.Bank && CookiStocker.Bank.secondsPerTick)
                CookiStocker.Bank.secondsPerTick = Math.max(0.001, stockerLoopFrequency/1000);
            break;
    }
    PlaySound('snd/tick.mp3');
};

CookiStocker.ChangeNumber = function(prefName, val){
    let v = Math.max(0, Math.floor(+val||0));
    switch(prefName){
        case 'stockerMinBrokers':
            stockerMinBrokers = Math.max(0, Math.min(162, v)); break;
        case 'stockerActivityReportFrequency':
            stockerActivityReportFrequency = Math.max(1000, v||3600000);
            if (CookiStocker.reportTimer){ clearInterval(CookiStocker.reportTimer); CookiStocker.reportTimer=0; }
            CookiStocker.ensureReportTimer();
            break;
        case 'stockerLoopFrequency':
            stockerLoopFrequency = Math.max(1000, v||30000);
            if (stockerForceLoopUpdates && CookiStocker.Bank && CookiStocker.Bank.secondsPerTick)
                CookiStocker.Bank.secondsPerTick = Math.max(0.001, stockerLoopFrequency/1000);
            break;
    }
    PlaySound('snd/tick.mp3');
};

CookiStocker.getMenuString = function(){
    if (typeof CCSE==='undefined' || !CCSE.MenuHelper) return '<div>CCSE not present; CookiStocker menu unavailable.</div>';
    const m = CCSE.MenuHelper;
    const minutes = (stockerActivityReportFrequency||0)/60000;
    const loopSeconds = Math.floor((stockerLoopFrequency||0)/1000);
    let str = '<div id="csRoot">';

    /* Automation */
    str += m.Header('Automation');
    str += '<div class="listing">'
        + m.ToggleButton(CookiStocker.state,'stockerAutoTrading','CS_autoTrading','Auto Trading ON','Auto Trading OFF',"CookiStocker.Toggle")
        + CookiStocker.note('stockerAutoTrading', false) + '</div>';

    str += '<div class="listing">'
        + m.ToggleButton(CookiStocker.state,'stockerMarketOn','CS_market','Stock Market ON','Stock Market OFF',"CookiStocker.Toggle")
        + CookiStocker.note('stockerMarketOn', false) + '</div>';

    str += '<div class="listing">'
        + m.ToggleButton(CookiStocker.state,'stockerAutoBuyMinimumBrokers','CS_autoBuyMinimumBrokers','Auto-buy Minimum Brokers ON','Auto-buy Minimum Brokers OFF',"CookiStocker.Toggle")
        + CookiStocker.note('stockerAutoBuyMinimumBrokers', false) + '</div>';

    str += '<div class="listing">'
        + m.ToggleButton(CookiStocker.state,'stockerAutoBuyAdditionalBrokers','CS_autoBuyAdditionalBrokers','Auto-buy Additional Brokers ON','Auto-buy Additional Brokers OFF',"CookiStocker.Toggle")
        + CookiStocker.note('stockerAutoBuyAdditionalBrokers', false) + '</div>';

    str += '<div class="listing">'
        + m.ToggleButton(CookiStocker.state,'stockerResourcesWarning','CS_resourcesWarning','Resources Warning ON','Resources Warning OFF',"CookiStocker.Toggle")
        + CookiStocker.note('stockerResourcesWarning', false) + '</div>';

    str += '<div class="listing">'
        + m.ToggleButton(CookiStocker.state,'stockerExponential','CS_Exponential','Exponential Warehouses ON','Exponential Warehouses OFF',"CookiStocker.Toggle")
        + CookiStocker.note('stockerExponential', false) + '</div>';

    // Exponential power slider
    var cbWarehouseExponent = "stockerExponentialPower = (l('exponentSlider').value); l('exponentSliderRightText').textContent = stockerExponentialPower; CookiStocker.TradingStats();";
    str += '<div class="listing">'
        + CCSE.MenuHelper.Slider('exponentSlider','Warehouse Exponent','<span id="exponentSliderRightText">'+stockerExponentialPower+'</span>',()=>stockerExponentialPower, cbWarehouseExponent, 0.1, 3.0, 0.1)
        + ' ' + CookiStocker.note('stockerExponentialPower', false) + '</div>';

    // Min brokers slider
    var cbMinBrokers = "stockerMinBrokers = Math.round(l('minBrokersSlider').value); l('minBrokersSliderRightText').textContent = stockerMinBrokers; l('CS_commissionVal').textContent = CookiStocker.calcCommission(stockerMinBrokers); CookiStocker.TradingStats();";
    str += '<div class="listing">'
        + CCSE.MenuHelper.Slider('minBrokersSlider','Minimum Brokers','<span id="minBrokersSliderRightText">'+stockerMinBrokers+'</span>',()=>stockerMinBrokers, cbMinBrokers, 0, 162, 1)
        + ' <span class="smallLabel">(Commission: <span id="CS_commissionVal">'+CookiStocker.calcCommission(stockerMinBrokers)+'</span>)</span>'
        + CookiStocker.note('stockerMinBrokers', false) + '</div>';

    // Bank % slider
    var stockerCookiesPercent = Math.round((stockerCookiesThreshold||0)*100);
    var cbCookies = "var v = Math.round(l('cookiesPercentSlider').value); stockerCookiesThreshold = v/100; l('cookiesPercentSliderRightText').textContent = v + '%'; CookiStocker.TradingStats();";
    str += '<div class="listing">'
        + CCSE.MenuHelper.Slider('cookiesPercentSlider','Max Bank % per Purchase','<span id="cookiesPercentSliderRightText">'+stockerCookiesPercent+'%</span>',()=>stockerCookiesPercent, cbCookies, 1, 100, 1)
        + ' ' + CookiStocker.note('stockerCookiesThreshold', false) + '</div>';

    /* Reporting */
    str += m.Header('Reporting & Notifications');

    str += '<div class="listing">'
        + m.ToggleButton(CookiStocker.state,'stockerTransactionNotifications','CS_txNotifs','TX Notifications ON','TX Notifications OFF',"CookiStocker.Toggle")
        + CookiStocker.note('stockerTransactionNotifications', false) + '</div>';

    str += '<div class="listing">'
        + m.ToggleButton(CookiStocker.state,'stockerFastNotifications','CS_fastNotifs','Fast Notifications ON','Fast Notifications OFF',"CookiStocker.Toggle")
        + CookiStocker.note('stockerFastNotifications', false) + '</div>';

    str += '<div class="listing">'
        + m.ToggleButton(CookiStocker.state,'stockerConsoleAnnouncements','CS_console','Console Announce ON','Console Announce OFF',"CookiStocker.Toggle")
        + CookiStocker.note('stockerConsoleAnnouncements', false) + '</div>';

    var _arMin = Math.floor(stockerActivityReportFrequency/60000);
    var _arSec = Math.floor((stockerActivityReportFrequency%60000)/1000);
    str += '<div class="listing">'
        + '<label>Report interval:</label> '
        + '<input id="CS_activityMin" class="smallInput" type="text" size="5" min="0" value="'+_arMin+'" style="text-align:right;width:3ch" inputmode="numeric" oninput="CookiStocker.ChangeTime(\'stockerActivityReportFrequency\',\'CS_activityMin\',\'CS_activitySec\');"> : '
        + '<input id="CS_activitySec" class="smallInput" type="text" size="5" min="0" max="59" value="'+_arSec+'" style="text-align:right;width:3ch" inputmode="numeric" oninput="CookiStocker.ChangeTime(\'stockerActivityReportFrequency\',\'CS_activityMin\',\'CS_activitySec\');"> '
        + '<span class="smallLabel">mm:ss</span>'
        + '</div>';

    str += '<div class="listing">'
        + m.ToggleButton(CookiStocker.state,'stockerAdditionalTradingStats','CS_moreStats','Extra Trading Stats ON','Extra Trading Stats OFF',"CookiStocker.Toggle")
        + CookiStocker.note('stockerAdditionalTradingStats', false) + '</div>';

    /* Timing (Advanced) */
    str += m.Header('Timing (Advanced)');
    str += '<div class="listing">'
        + '<label>Loop (seconds): </label>'
        + '<input id="CS_loopFreq" type="text" size="5" value="'+loopSeconds+'" style="text-align:right;width:5ch" inputmode="numeric" oninput="CookiStocker.ChangeNumber(\'stockerLoopFrequency\', this.value);" />'
        + CookiStocker.note('stockerLoopFrequency', true) + '</div>';

    str += '<div class="listing">'
        + m.ToggleButton(CookiStocker.state,'stockerForceLoopUpdates','CS_forceLoop','Force Loop (cheat) ON','Force Loop (cheat) OFF',"CookiStocker.Toggle")
        + CookiStocker.note('stockerForceLoopUpdates', true) + '</div>';

    str += '</div>';
    return str;
};

CookiStocker.ReplaceGameMenu = function(){
    if (typeof CCSE==='undefined' || !CCSE.AppendCollapsibleOptionsMenu || !CCSE.AppendStatsVersionNumber) return;

    Game.customOptionsMenu.push(function(){
        const content = document.createElement('div');
        content.innerHTML = CookiStocker.getMenuString();
        CCSE.AppendCollapsibleOptionsMenu(CookiStocker.name, content);
    });

    Game.customStatsMenu.push(function(){
        CCSE.AppendStatsVersionNumber(CookiStocker.name, CookiStocker.version);
        if (!CookiStocker.Bank || !CookiStocker.Bank.goodsById) return;
        var p = CookiStocker.Bank.profit;
        CCSE.AppendStatsGeneral('<div class="listing"><b>Stock Market has earned you :</b><div class="price plain"> $'+Beautify(p)+' ('+Game.tinyCookie()+Beautify(p*Game.cookiesPsRawHighest)+' cookies)</div></div>');
    });
};

/* ===================== Achievements (defensive) ===================== */

CookiStocker.ensureAchievements = function(){
    if (typeof CCSE==='undefined' || !CCSE.NewAchievement) return; // CCSE not ready → skip
    if (Game.Achievements['Plasmic assets'] && Game.Achievements['Bose-Einstein Condensed Assets']) return;

    CookiStocker.AchPlasmic = CCSE.NewAchievement(
        'Plasmic assets',
        'Have your stock market profits surpass <b>$100 million</b>.<q>This will get you charged up!</q><q>Your warehouse companies double their space.</q>',
        [10,13]
    );
    CookiStocker.AchPlasmic.order = 1003100;

    CookiStocker.AchBoseEinstein = CCSE.NewAchievement(
        'Bose-Einstein Condensed Assets',
        'Have your stock market profits surpass <b>$500 million</b>.<q>You have so many assets, we need to condense them!</q><q>Your warehouse companies double their space.</q>',
        [9,19]
    );
    CookiStocker.AchBoseEinstein.pool = 'shadow';
    CookiStocker.AchBoseEinstein.order = 1003101;
};

/* ===================== Market tick hook & timers ===================== */

CookiStocker._onMarketTick = function(){
    if (Game.OnAscend) return;
    if (CookiStocker._tickTimeout){ clearTimeout(CookiStocker._tickTimeout); CookiStocker._tickTimeout=0; }
    if (CookiStocker._reportTimeout){ clearTimeout(CookiStocker._reportTimeout); CookiStocker._reportTimeout=0; }

    CookiStocker._tickTimeout = setTimeout(function(){
        try {
            if (typeof stockerLoop==='function') stockerLoop();
            else if (typeof CookiStocker.stockerLoop==='function') CookiStocker.stockerLoop();
        } catch(e){}
        var delay = stockerForceLoopUpdates ? 0 : 30000;
        CookiStocker._reportTimeout = setTimeout(function(){ try{ CookiStocker.Reports(); }catch(e){} }, delay);
    }, 500);
};

CookiStocker.installBankTickHook = function(){
    if (CookiStocker._tickHookInstalled) return;
    var M = Game && Game.Objects && Game.Objects['Bank'] && Game.Objects['Bank'].minigame;
    if (!M || typeof M.tick!=='function') return;
    CookiStocker._tickHookInstalled = 1;
    var _origTick = M.tick;
    M.tick = function(){
        var ret = _origTick.apply(this, arguments);
        if (typeof stockerMarketOn==='undefined' || stockerMarketOn) CookiStocker._onMarketTick();
        return ret;
    };
};

/* Ensure exactly one periodic reporter and keep in sync with preferences */
CookiStocker.ensureReportTimer = function(){
    if (Game.OnAscend && CookiStocker.reportTimer){
        clearInterval(CookiStocker.reportTimer); CookiStocker.reportTimer=0;
    }
    const need = stockerMarketOn && (stockerActivityReport || stockerConsoleAnnouncements);
    const next = need ? Math.max(1000, (+stockerActivityReportFrequency||3600000)) : 0;
    if (!need){
        if (CookiStocker.reportTimer){ clearInterval(CookiStocker.reportTimer); CookiStocker.reportTimer=0; }
        CookiStocker._reportEveryMs = 0;
        return;
    }
    if (CookiStocker.reportTimer && CookiStocker._reportEveryMs===next) return;
    if (CookiStocker.reportTimer){ clearInterval(CookiStocker.reportTimer); CookiStocker.reportTimer=0; }
    CookiStocker._reportEveryMs = next;
    CookiStocker.reportTimer = setInterval(function(){ CookiStocker.Reports(); }, next);
};

/* ===================== Safe patch for getGoodMaxStock ===================== */

CookiStocker.patchMaxStock = function(){
    var M = Game && Game.Objects && Game.Objects['Bank'] && Game.Objects['Bank'].minigame;
    if (!M || typeof M.getGoodMaxStock!=='function') return;

    // If we already wrapped, skip
    if (M.getGoodMaxStock[CookiStocker._wrappedGetSignature]) return;

    const orig = M.getGoodMaxStock;
    CookiStocker._origGetGoodMaxStock = orig;

    M.getGoodMaxStock = function(good){
        // Always try base first; never let this return undefined
        let base;
        try { base = orig.call(this, good); } catch(e){ base = 0; }
        try{
            // Defensive: bank/state may not be ready
            if (!CookiStocker.Bank || !Game || !Game.Objects || !Game.Objects['Bank']) return base;

            // Only enhance when office level and profits allow
            if (CookiStocker.Bank.officeLevel < 3 || (stockList.Profits|0) < CS_PLASMIC_PROFITS) return Math.ceil(base);

            let mult = 1;

            // Shadow pool promotion for Gaseous assets, but never block base value
            if (!stockList.shadowGone && stockList.Profits >= CS_GASEOUS_PROFITS){
                if (Game.Achievements['Gaseous assets'] && Game.Achievements['Gaseous assets'].won){
                    Game.Achievements['Gaseous assets'].pool = '';
                    stockList.shadowGone = true;
                }
            }

            if (Game.Objects['Bank'].level >= 12){
                if (stockerExponential && stockList.origCookiesPsRawHighest){
                    const ratio = (Game.cookiesPsRawHighest || 0) / (stockList.origCookiesPsRawHighest || 1);
                    if (isFinite(ratio) && ratio>0) mult *= Math.pow(ratio, (stockerExponentialPower||1));
                }
                if (Game.Achievements['Plasmic assets'] && Game.Achievements['Plasmic assets'].won && stockList.Profits >= CS_PLASMIC_PROFITS*mult) mult *= 2;
                if (Game.Achievements['Bose-Einstein Condensed Assets'] && Game.Achievements['Bose-Einstein Condensed Assets'].won && stockList.Profits >= CS_BOSE_EINSTEIN_PROFITS*mult) mult *= 2;
            }
            return Math.ceil(base * mult);
        } catch(e){
            // If anything goes wrong, fall back to base rather than crashing loops/tooltips
            return Math.ceil(base);
        }
    };

    // Mark wrapper
    M.getGoodMaxStock[CookiStocker._wrappedGetSignature] = true;
    M.getGoodMaxStock._orig = orig;
};

/* ===================== Core UI build and loop ===================== */

CookiStocker.startStocking = function(){
    const B = Game && Game.Objects && Game.Objects['Bank'];
    if (!B || !B.minigame){
        setTimeout(()=>CookiStocker.startStocking(), 500);
        return;
    }
    CookiStocker.Bank = B.minigame;

    ensureStockerStyles();
    CookiStocker.patchMaxStock();
    CookiStocker.installBankTickHook();

    // First line (profits/hour/day etc.)
    let datStr = `
    <div class="stocker-stats">
      <span class="stat">Net profits: <span id="Profits">$0</span>.</span>
      <span class="stat">Profits per hour: <span id="profitsHour">$0</span>.</span>
      <span class="stat">Profits per day: <span id="profitsDay">$0</span>.</span>
      <span class="stat">Gross profits: <span id="grossProfits">$0</span>.</span>
      <span class="stat">Gross losses: <span id="grossLosses">$0</span>.</span>
      <span class="stat">Runtime: <span id="runTime">${stockerForceLoopUpdates ? "0:00:00" : "0:00"}</span></span>
    </div>`;

    // Warning lines
    let datStrWarn = `
    <div class="stocker-stats" id="stockerWarnLine" style="display:none;">
      <span class="stat" style="font-size:12px;color:#ff3b3b;font-weight:bold;">THERE ARE INSUFFICENT RESOURCES TO RUN AUTOMATIC TRADING. PLEASE SEE THE FOLLOWING LINE AND READ THE STEAM GUIDE.</span>
    </div>`;
    let datStrWarn2 = `
    <div class="stocker-stats" id="stockerWarnLine2" style="display:none;">
      <span class="stat" style="font-size:12px;color:#ff3b3b;font-weight:bold;">AUTO TRADING IS TURNED OFF IN THE OPTIONS.</span>
    </div>`;
    let datStrWarn3 = `
    <div class="stocker-stats" id="stockerWarnLine3" style="display:none;">
      <span class="stat" style="font-size:12px;color:#ff3b3b;font-weight:bold;">THE STOCK MARKET IS TURNED OFF IN THE OPTIONS.</span>
    </div>`;

    // Brokers/cookies line
    let datStr1 = `
    <div class="stocker-stats">
      <span class="stat">Brokers: <span id="Brokers">0</span>.</span>
      <span class="stat">Brokers Needed: <span id="brokersNeeded">0</span>.</span>
      <span class="stat">Banked cookies: <span id="bankedCookies">0</span>.</span>
      <span class="stat">Required cookie minimum: <span id="minCookies">0</span>.</span>
      <span class="stat">Maximum: <span id="maxCookies">0</span>.</span>
    </div>`;

    if (l('bankHeader') && l('bankHeader').firstChild){
        const host = l('bankHeader').firstChild;
        host.insertAdjacentHTML('beforeend', datStr);
        host.insertAdjacentHTML('beforeend', datStrWarn);
        host.insertAdjacentHTML('beforeend', datStrWarn2);
        host.insertAdjacentHTML('beforeend', datStrWarn3);
        host.insertAdjacentHTML('beforeend', datStr1);

        let extra = l(CookiStocker.extraStatsId);
        if (!extra){
            extra = document.createElement('div');
            extra.id = CookiStocker.extraStatsId;
            host.appendChild(extra);
        }
        if (stockerAdditionalTradingStats){
            extra.innerHTML = CookiStocker.buildExtraStatsHTML();
            extra.style.display = '';
        } else {
            extra.innerHTML = '';
            extra.style.display = 'none';
        }
    }

    // Warm market snapshot
    let market = CookiStocker.Bank.goodsById;
    stockList.startingProfits = CookiStocker.Bank.profit;
    stockList.Goods = [];
    for (let i=0;i<market.length;i++){
        stockList.Goods.push({
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
    }

    CookiStocker.ensureAchievements();
    CookiStocker.ensureReportTimer();
    CookiStocker.TradingStats();

    // main loop (defensive; avoids doing anything during ascend or missing DOM)
    if (CookiStocker._loopTimer){ clearInterval(CookiStocker._loopTimer); CookiStocker._loopTimer=0; }
    CookiStocker._loopTimer = setInterval(function(){
        if (Game.OnAscend || (typeof Game.AscendTimer!=='undefined' && Game.AscendTimer>0) || !l("Brokers")) return;

        // sync Bank tick rate to our loop unless we’re forcing
        if (stockerMarketOn){
            if (stockList.noModActions){ stockList.noModActions=false; CookiStocker.TradingStats(); }
            CookiStocker.Bank.secondsPerTick = stockerForceLoopUpdates ? Math.max(0.001, stockerLoopFrequency/1000) : 60;
        } else {
            if (stockList.noModActions) return;
            CookiStocker.Bank.secondsPerTick = CS_TEN_YEARS;
        }

        // achievements gating (guarded)
        if (CookiStocker.Bank.profit >= 100000000 && Game.Achievements['Plasmic assets'] && !Game.Achievements['Plasmic assets'].won) Game.Win('Plasmic assets');
        if (CookiStocker.Bank.profit >= 500000000 && Game.Achievements['Bose-Einstein Condensed Assets'] && !Game.Achievements['Bose-Einstein Condensed Assets'].won) Game.Win('Bose-Einstein Condensed Assets');

        const smallDelta = 3, largeDelta = 4, alwaysBuyBelow = 2, neverSellBelow = 11;
        let amount = 0;

        // auto-buy brokers
        if (!Game.OnAscend && (stockerAutoBuyMinimumBrokers || stockerAutoBuyAdditionalBrokers)){
            let tradingStats = false;
            let need = stockerMinBrokers - CookiStocker.Bank.brokers;
            if (stockerAutoBuyMinimumBrokers && need>0 && stockerMinBrokers <= CookiStocker.Bank.getMaxBrokers() && need * CookiStocker.Bank.getBrokerPrice() < Game.cookies*0.1){
                Game.Spend(CookiStocker.Bank.getBrokerPrice()*need);
                CookiStocker.Bank.brokers = stockerMinBrokers;
                tradingStats = true;
            }
            let buyMore = CookiStocker.Bank.getMaxBrokers() - CookiStocker.Bank.brokers;
            let cost = CookiStocker.Bank.getBrokerPrice() * buyMore;
            if (stockerAutoBuyAdditionalBrokers && buyMore>0 && cost < Game.cookies*0.1){
                Game.Spend(cost);
                CookiStocker.Bank.brokers += buyMore;
                tradingStats = true;
            }
            if (tradingStats) CookiStocker.TradingStats();
        }

        // market refresh
        market = CookiStocker.Bank.goodsById;
        stockList.canBuy = stockerAutoTrading && CookiStocker.Bank.brokers >= stockerMinBrokers;

        // throttle buys if we’d exceed cookies threshold
        for (let i=0;i<market.length;i++){
            if (stockList.canBuy && !((CookiStocker.Bank.getGoodMaxStock(market[i]) - market[i].stock) * Game.cookiesPsRawHighest * market[i].val < Game.cookies * stockerCookiesThreshold)){
                let now = Date.now(); let remainder;
                stockList.Start += now - stockList.lastTime;
                stockList.Uptime = Math.floor((now - stockList.Start)/1000)*1000;
                if ( (remainder = stockList.Uptime % stockerLoopFrequency) ){
                    stockList.Start += CookiStocker.Bank.secondsPerTick*1000 + remainder;
                    stockList.Uptime -= CookiStocker.Bank.secondsPerTick*1000 + remainder;
                }
                stockList.lastTime = now;
                CookiStocker.TradingStats();
                stockList.canBuy = false;
                if (!stockerAutoTrading){
                    stockList.noModActions = true;
                    if (CookiStocker.reportTimer){ clearInterval(CookiStocker.reportTimer); CookiStocker.reportTimer=0; }
                }
            }
            amount += Game.ObjectsById[i+2].amount;
        }
        if (!(stockList.Amount = amount)) return;

        CookiStocker.TradingStats();
        CookiStocker.ensureReportTimer();
        if (stockList.canBuy && !stockList.origCookiesPsRawHighest) stockList.origCookiesPsRawHighest = Game.cookiesPsRawHighest;

        for (let i=0;i<market.length;i++){
            let stockerNotificationTime = stockerFastNotifications * 6;
            let lastPrice = stockList.Goods[i].currentPrice;
            let currentPrice = market[i].val;

            stockList.Goods[i].stock = market[i].stock;
            stockList.Goods[i].currentPrice = currentPrice;
            stockList.Goods[i].mode = market[i].mode;

            let md = stockList.Goods[i].mode;
            let lmd = stockList.Goods[i].lastMode;
            let lastStock = market[i].stock;
            let deltaPrice = largeDelta;
            let stockName = market[i].name.replace('%1', Game.bakeryName);

            // defensive ceiling: max of bank ceiling and legacy ceiling
            let ceilingPrice = Math.max(10*(i+1) + Game.Objects['Bank'].level + 49, 97 + Game.Objects['Bank'].level*3);

            if (stockList.Goods[i].lastDur != market[i].dur || ++stockList.Goods[i].unchangedDur > 1){
                stockList.Goods[i].unchangedDur = 0;
            }

            if (lmd == md && (stockList.Goods[i].stock && (md==2||md==4) || !stockList.Goods[i].stock && (md==1||md==3))) deltaPrice = smallDelta;

            if (md != lmd && ((md==3 && lmd!=1) || (md==4 && lmd!=2) || (md==1 && lmd!=3) || (md==2 && lmd!=4))){
                stockList.Goods[i].dropCount = 0;
                stockList.Goods[i].riseCount = 0;
            } else if (currentPrice > lastPrice){
                stockList.Goods[i].dropCount = 0;
                stockList.Goods[i].riseCount++;
            } else if (currentPrice < lastPrice){
                stockList.Goods[i].riseCount = 0;
                stockList.Goods[i].dropCount++;
            }

            stockList.Goods[i].lastDur = market[i].dur;

            // BUY
            if (
                (
                    currentPrice < alwaysBuyBelow ||
                    (md != 4 && (
                        (currentPrice > lastPrice && stockList.Goods[i].riseCount >= deltaPrice) ||
                        ((md==1 || md==3) && md != lmd) ||
                        (md==0 && !stockList.Goods[i].someSold && stockList.Goods[i].dropCount < deltaPrice && currentPrice >= 10)
                    ) && (currentPrice < ceilingPrice || md==1 || md==3))
                )
                && stockList.canBuy
                && ((CookiStocker.Bank.getGoodMaxStock(market[i]) - market[i].stock) * Game.cookiesPsRawHighest * market[i].val < Game.cookies * stockerCookiesThreshold)
                && CookiStocker.Bank.brokers >= stockerMinBrokers
                && CookiStocker.Bank.buyGood(i,10000)
            ){
                let units = market[i].stock - lastStock;
                stockList.Goods[i].someBought = true;
                stockList.Goods[i].stock = market[i].stock;
                if (typeof market[i].prevBuyMode1 !== 'undefined'){ market[i].prevBuyMode1 = lmd; market[i].prevBuyMode2 = md; }
                market[i].buyTime = Date.now();
                if (typeof StockAssistant !== 'undefined'){
                    StockAssistant.stockData.goods[i].boughtVal = market[i].prev;
                    StockAssistant.buyGood(i);
                }
                stockList.Purchases++;
                if (stockerTransactionNotifications){
                    if (currentPrice >= 2) Game.Notify(`Buying ${stockName} ${new Date().toLocaleTimeString([], {hourCycle: 'h23', hour: '2-digit', minute: '2-digit'})}`,`Buying ${units} unit${(units>1?'s':'')}. The stock ${ (lmd!=md)?('is no longer in '+modeDecoder[lmd]+' mode'):'is' } at $${Beautify(market[i].prev,2)} per unit and is in ${modeDecoder[md]} mode now.`,goodIcons[i],stockerNotificationTime);
                    else Game.Notify(`Buying ${stockName} ${new Date().toLocaleTimeString([], {hourCycle: 'h23', hour: '2-digit', minute: '2-digit'})}`, `Buying ${units} unit${(units>1?'s':'')}. The price has dropped below $2 per unit, and your buying price is $${Beautify(market[i].prev,2)}.`,goodIcons[i],stockerNotificationTime);
                }
                if (stockerConsoleAnnouncements) console.log('=====$$$=== Buying '+ stockName + ' at $' + Beautify(market[i].prev,2));
            }
            // SELL
            else if (
                stockList.Goods[i].stock > 0 &&
                (
                    (currentPrice < lastPrice && stockList.Goods[i].dropCount >= deltaPrice) ||
                    ((md==2 || md==4) && md != lmd)
                )
                && currentPrice >= neverSellBelow
            ){
                let profit = 0;
                if (!CookiStocker.Bank.sellGood(i, stockList.Goods[i].stock)){
                    stockList.Goods[i].lastMode = stockList.Goods[i].mode;
                    continue;
                }
                stockList.Goods[i].someSold = true;
                market[i].prevSale = market[i].val;
                market[i].prevSellMode1 = lmd;
                market[i].prevSellMode2 = md;
                market[i].sellTime = Date.now();
                if (typeof StockAssistant !== 'undefined') StockAssistant.sellGood(i);
                stockList.Sales++;
                profit = (market[i].val - market[i].prev) * stockList.Goods[i].stock;
                stockList.Goods[i].profit += profit;
                if (profit > 0){ stockList.grossProfits += profit; stockList.profitableTrades++; }
                else { stockList.grossLosses += -profit; stockList.unprofitableTrades++; }
                stockList.netProfits += profit;
                stockerModeProfits[lmd][md][0] += profit;
                stockerModeProfits[lmd][md][1] += profit;
                stockerModeProfits[lmd][md][2]++;

                if (stockerTransactionNotifications){
                    let strProfit = profit>=0 ? 'profit ' : 'loss ';
                    let shown = profit>=0 ? profit : -profit;
                    Game.Notify(`Selling ${stockName} ${new Date().toLocaleTimeString([], {hourCycle: 'h23', hour: '2-digit', minute: '2-digit'})}`,
                        `Selling ${stockList.Goods[i].stock} unit${(stockList.Goods[i].stock>1?'s':'')} at $${Beautify(market[i].val,2)} for a ${strProfit}of $${Beautify(shown,2)} (rev $${Beautify(market[i].val*stockList.Goods[i].stock,2)}).`, goodIcons[i], stockerNotificationTime);
                }
                if (stockerConsoleAnnouncements) console.log(`=====$$$=== Selling ${stockName} at $${Beautify(market[i].val,2)} for ${profit>=0?'profit':'loss'} $${Beautify(Math.abs(profit),2)}`);
            }

            stockList.Profits = CookiStocker.Bank.profit - stockList.startingProfits;
            stockList.Goods[i].lastMode = stockList.Goods[i].mode;
        }

        stockList.profitableStocks = 0; stockList.unprofitableStocks = 0;
        for (let i=0;i<market.length;i++){
            if (stockList.Goods[i].profit > 0) stockList.profitableStocks++;
            else if (stockList.Goods[i].profit < 0) stockList.unprofitableStocks++;
        }

        CookiStocker.TradingStats();

        if (!stockerMarketOn){
            if (CookiStocker.reportTimer){ clearInterval(CookiStocker.reportTimer); CookiStocker.reportTimer=0; }
            CookiStocker.Reports();
            stockList.noModActions = true;
            return;
        }
    }, stockerLoopFrequency);
};

/* ===================== Reports & stats painting ===================== */

CookiStocker.Reports = function(){
    if (!l("Brokers") || !stockList.Amount || !stockList.canBuy) return;
    CookiStocker.TradingStats();
    if (stockList.noModActions || (!stockerActivityReport && !stockerConsoleAnnouncements)) return;

    let stockerNotificationTime = stockerFastNotifications * 6;

    if (stockerActivityReport){
        if ((stockList.Purchases + stockList.Sales) == 0){
            Game.Notify(`CookiStocker report ${new Date().toLocaleTimeString([], {hourCycle: 'h23', hour: '2-digit', minute: '2-digit'})}`,
                        `This session has been running for ${stockerTimeBeautifier(stockList.Uptime)}, but no good investment opportunities were detected!`, [1,33], stockerNotificationTime);
        } else {
            Game.Notify(`CookiStocker report ${new Date().toLocaleTimeString([], {hourCycle: 'h23', hour: '2-digit', minute: '2-digit'})}`,
                        `Running for ${stockerTimeBeautifier(stockList.Uptime)}; net $${Beautify(stockList.netProfits,0)}, displayed $${Beautify(stockList.Profits,0)} in ${Beautify(stockList.Purchases,0)} buys and ${Beautify(stockList.Sales,0)} sells.`, [1,33], stockerNotificationTime);
        }
    }
    if (stockerConsoleAnnouncements){
        let totalProfits = 0, deltaTotalProfits = 0, totalTrades = 0;
        for (let j=0;j<6;j++) for (let k=0;k<6;k++) totalProfits += stockerModeProfits[j][k][0];
        for (let j=0;j<6;j++) for (let k=0;k<6;k++){ deltaTotalProfits += stockerModeProfits[j][k][1]; totalTrades += stockerModeProfits[j][k][2]; }
        stockList.hourlyProfits = totalProfits * (stockerLoopFrequency/60000) * 3600000 / (stockList.Uptime + 1);
        stockList.dailyProfits  = totalProfits * (stockerLoopFrequency/60000) * 86400000 / (stockList.Uptime + 1);
        if (!stockerForceLoopUpdates){ stockList.hourlyProfits *= 2; stockList.dailyProfits *= 2; }
        console.log(`Total profits = $${Beautify(totalProfits,2)}   Δ $${Beautify(deltaTotalProfits,2)}   ${totalTrades} trade${totalTrades!=1?'s':''}`);
        console.log(`Profit per hour = $${Beautify(stockList.hourlyProfits,2)}; per day = $${Beautify(stockList.dailyProfits,2)}`);
        for (let j=0;j<6;j++) for (let k=0;k<6;k++) stockerModeProfits[j][k][1] = 0; // clear deltas
        console.log('------------------------------------------------------------------');
    }
};

CookiStocker.DataStats = function(id, value, dollars){
    let it = l(id); if (!it) return;
    it.innerHTML = (value < 0 ? "-" : "") + (dollars?'$':'') + Beautify(Math.abs(value), 0);
    if (id==="Brokers" && CookiStocker.Bank.brokers < stockerMinBrokers) value = -1;
    else if (id==="bankedCookies"){
        if (Game.cookies > stockList.minCookies && Game.cookies < stockList.maxCookies){
            it.classList.remove("green");
            it.style.color = 'yellow';
            return;
        } else if (Game.cookies < stockList.minCookies) value = -1;
    }
    if (value > 0){ it.classList.add("green"); it.style.color=''; }
    else if (value < 0){ it.classList.remove("green"); it.classList.remove("yellow"); it.style.color='#ff3b3b'; }
};

CookiStocker.TradingStats = function(){
    if (!CookiStocker.Bank) return;

    let now = Date.now();
    let market = CookiStocker.Bank.goodsById;

    if (now > stockList.lastTime + stockerActivityReportFrequency + 500)
        stockList.Start += now - stockList.lastTime - stockerActivityReportFrequency;

    stockList.totalStocks=0; stockList.totalShares=0; stockList.totalValue=0; stockList.unrealizedProfits=0;
    for (let i=0;i<market.length;i++){
        if (stockList.Goods[i] && stockList.Goods[i].stock){
            stockList.totalStocks++;
            stockList.totalShares += stockList.Goods[i].stock;
            stockList.totalValue  += stockList.Goods[i].stock * (stockList.Goods[i].currentPrice||0);
            stockList.unrealizedProfits += ((market[i].val||0) - (market[i].prev||0)) * stockList.Goods[i].stock;
        }
    }

    stockList.minCookies = Number.MAX_VALUE; stockList.maxCookies = 0;
    for (let i=0;i<market.length;i++){
        let shares = Math.max(0, (CookiStocker.Bank.getGoodMaxStock(market[i])||0) - (market[i].stock||0));
        let cookies = shares * (Game.cookiesPsRawHighest||0) * (market[i].val||0) / Math.max(0.000001, stockerCookiesThreshold);
        if (shares && cookies < stockList.minCookies) stockList.minCookies = cookies;
        if (shares && cookies > stockList.maxCookies) stockList.maxCookies = cookies;
    }

    CookiStocker.DataStats("Brokers", CookiStocker.Bank.brokers, 0);
    CookiStocker.DataStats("brokersNeeded", stockerMinBrokers, 0);
    CookiStocker.DataStats("bankedCookies", Game.cookies, 0);
    CookiStocker.DataStats("minCookies", stockList.minCookies, 0);
    CookiStocker.DataStats("maxCookies", stockList.maxCookies, 0);
    CookiStocker.DataStats("Profits", stockList.netProfits, 1);
    CookiStocker.DataStats("profitsHour", stockList.hourlyProfits, 1);
    CookiStocker.DataStats("profitsDay", stockList.dailyProfits, 1);
    CookiStocker.DataStats("grossProfits", stockList.grossProfits, 1);
    CookiStocker.DataStats("grossLosses", -stockList.grossLosses, 1);

    stockList.lastTime = now;
    stockList.Uptime = Math.floor((now - stockList.Start)/1000)*1000;
    stockList.Uptime -= stockList.Uptime % Math.max(1, stockerLoopFrequency);

    let uptimeHours = Math.floor(stockList.Uptime/3600000);
    let uptimeDays = Math.floor(uptimeHours/24);
    if (uptimeDays>=1){ uptimeDays+=':'; uptimeHours%=24; if (uptimeHours<10) uptimeHours='0'+uptimeHours; } else uptimeDays='';
    let it = l("runTime"); if (it){
        it.innerHTML = uptimeDays + uptimeHours + ':';
        if (stockerForceLoopUpdates){
            it.innerHTML += new Date(stockList.Uptime).toLocaleTimeString([], {minute:'2-digit', second:'2-digit'});
        } else {
            let uptimeMinutes = (Math.floor(stockList.Uptime/60000)) % 60;
            it.innerHTML += (uptimeMinutes<10?'0':'') + uptimeMinutes;
        }
        if (it.innerHTML=='') it.innerHTML = "0:00";
    }

    if (stockerAdditionalTradingStats){
        CookiStocker.DataStats("netCookies", stockList.netProfits * (Game.cookiesPsRawHighest||0), 0);
        CookiStocker.DataStats("cookiesHour", stockList.hourlyProfits * (Game.cookiesPsRawHighest||0), 0);
        CookiStocker.DataStats("cookiesDay", stockList.dailyProfits * (Game.cookiesPsRawHighest||0), 0);
        if (l("Purchases")) l("Purchases").innerHTML = stockList.Purchases;
        if (l("Sales")) l("Sales").innerHTML = stockList.Sales;
        if (l("cpsMultiple")) l("cpsMultiple").innerHTML = stockList.hourlyProfits>=0 ? Beautify(stockList.hourlyProfits/3600,3) : -Beautify(-stockList.hourlyProfits/3600,3);
        if (l("stocksHeld")) l("stocksHeld").innerHTML = stockList.totalStocks;
        if (l("totalShares")) l("totalShares").innerHTML = Beautify(stockList.totalShares);
        CookiStocker.DataStats("totalValue", stockList.totalValue, 1);
        CookiStocker.DataStats("unrealizedProfits", stockList.unrealizedProfits, 1);
        if (l("profitableStocks")) l("profitableStocks").innerHTML = stockList.profitableStocks;
        if (l("unprofitableStocks")) l("unprofitableStocks").innerHTML = stockList.unprofitableStocks;
        if (l("profitableTrades")) l("profitableTrades").innerHTML = stockList.profitableTrades;
        if (l("unprofitableTrades")) l("unprofitableTrades").innerHTML = stockList.unprofitableTrades;
        CookiStocker.DataStats("averageProfit", stockList.profitableTrades ? stockList.grossProfits/stockList.profitableTrades : 0, 1);
        CookiStocker.DataStats("averageLoss", stockList.unprofitableTrades ? -stockList.grossLosses/stockList.unprofitableTrades : 0, 1);
    }

    CookiStocker.updateWarn();
};

CookiStocker.updateWarn = function(){
    let warn = l('stockerWarnLine'), warn2 = l('stockerWarnLine2'), warn3 = l('stockerWarnLine3');
    if (warn) warn.style.display='none';
    if (warn2) warn2.style.display='none';
    if (warn3) warn3.style.display='none';
    if (!stockerResourcesWarning) return;

    if (warn3 && !stockerMarketOn){ warn3.style.display=''; return; }
    if (warn2 && !stockerAutoTrading){ warn2.style.display=''; return; }

    warn = l('stockerWarnLine');
    if (!warn) return;

    if (CookiStocker.Bank.brokers < stockerMinBrokers){ warn.style.display=''; return; }

    let market = CookiStocker.Bank.goodsById;
    for (let i=0;i<market.length;i++){
        if ( (CookiStocker.Bank.getGoodMaxStock(market[i]) - market[i].stock) * (Game.cookiesPsRawHighest||0) * (market[i].val||0) >= (Game.cookies||0) * stockerCookiesThreshold ){
            warn.style.display=''; return;
        }
    }
    warn.style.display='none';
};

/* ===================== Save / Load / Reset ===================== */

CookiStocker.save = function(){
    if (!CookiStocker.Bank) return '';
    let str = '';
    let market = CookiStocker.Bank.goodsById;

    str += Number(stockList.Check)||0;

    for (let i=0;i<market.length;i++){
        str += '_' + encodeURIComponent(stockList.Goods[i].name||'');
        str += '_' + Number(stockList.Goods[i].stock||0);
        str += '_' + Number(stockList.Goods[i].val||0);
        str += '_' + Number(stockList.Goods[i].currentPrice||0);
        str += '_' + Number(stockList.Goods[i].mode||0);
        str += '_' + Number(stockList.Goods[i].lastMode||0);
        str += '_' + Number(stockList.Goods[i].lastDur||0);
        str += '_' + Number(stockList.Goods[i].unchangedDur||0);
        str += '_' + Number(stockList.Goods[i].dropCount||0);
        str += '_' + Number(stockList.Goods[i].riseCount||0);
        str += '_' + Number(stockList.Goods[i].profit||0);
        str += '_' + (+!!stockList.Goods[i].someSold);
        str += '_' + (+!!stockList.Goods[i].someBought);
    }

    str += '_' + Number(stockList.Start||0);
    str += '_' + Number(stockList.lastTime||0);
    str += '_' + Number(stockList.startingProfits||0);
    str += '_' + Number(stockList.Profits||0);
    str += '_' + Number(stockList.netProfits||0);
    str += '_' + Number(stockList.grossProfits||0);
    str += '_' + Number(stockList.grossLosses||0);
    str += '_' + Number(stockList.totalStocks||0);
    str += '_' + Number(stockList.totalShares||0);
    str += '_' + Number(stockList.totalValue||0);
    str += '_' + Number(stockList.unrealizedProfits||0);
    str += '_' + Number(stockList.profitableStocks||0);
    str += '_' + Number(stockList.unprofitableStocks||0);
    str += '_' + Number(stockList.profitableTrades||0);
    str += '_' + Number(stockList.unprofitableTrades||0);
    str += '_' + Number(stockList.Purchases||0);
    str += '_' + Number(stockList.Sales||0);
    str += '_' + Number(stockList.Uptime||0);
    str += '_' + Number(stockList.hourlyProfits||0);
    str += '_' + Number(stockList.dailyProfits||0);
    str += '_' + Number(stockList.minCookies||0);
    str += '_' + Number(stockList.maxCookies||0);
    str += '_' + (+!!stockList.noModActions);
    str += '_' + Number(stockList.origCookiesPsRawHighest||0);

    for (let i=0;i<stockerModeProfits.length;i++)
        for (let j=0;j<stockerModeProfits[i].length;j++)
            for (let k=0;k<stockerModeProfits[i][j].length;k++)
                str += '_' + Number(stockerModeProfits[i][j][k]||0);

    str += '_' + Number(Game.Achievements['Plasmic assets'] ? +Game.Achievements['Plasmic assets'].won : 0);
    str += '_' + Number(Game.Achievements['Bose-Einstein Condensed Assets'] ? +Game.Achievements['Bose-Einstein Condensed Assets'].won : 0);

    const cfg = {
        stockerAutoTrading, stockerMinBrokers, stockerAutoBuyMinimumBrokers, stockerTransactionNotifications,
        stockerActivityReport, stockerActivityReportFrequency, stockerFastNotifications, stockerConsoleAnnouncements,
        stockerAdditionalTradingStats, stockerLoopFrequency, stockerForceLoopUpdates, stockerCookiesThreshold,
        stockerResourcesWarning, stockerMarketOn, stockerExponential, stockerExponentialPower, stockerAutoBuyAdditionalBrokers,
    };
    str += '|CFG:' + JSON.stringify(cfg);
    return str;
};

CookiStocker.load = function(str){
    if (!CookiStocker.Bank || !str || !(stockList.Goods && stockList.Goods.length)) return false;

    // pull optional |CFG: tail first
    let cfg = null;
    let cfgIdx = (str||'').indexOf('|CFG:');
    if (cfgIdx > -1){
        try { cfg = JSON.parse(str.slice(cfgIdx+5)); } catch(e){ cfg = null; }
        str = str.slice(0, cfgIdx);
    }

    let i = 0, j, k, m;
    let spl = str.split('_');
    let market = CookiStocker.Bank.goodsById;

    // detect legacy tails
    stockList.Check = Number(spl[i++]||0);

    for (j=0;j<market.length;j++){
        let tok = (spl[i++]||''); let nm;
        try { nm = decodeURIComponent(tok); } catch(e){ nm = tok; }
        if (!nm || nm==='NaN') nm = market[j].name;
        if (!stockList.Goods[j]) stockList.Goods[j] = {};
        stockList.Goods[j].name = nm;
        stockList.Goods[j].stock = Number(spl[i++]||0);
        stockList.Goods[j].val = Number(spl[i++]||0);
        stockList.Goods[j].currentPrice = Number(spl[i++]||0);
        stockList.Goods[j].mode = Number(spl[i++]||0);
        stockList.Goods[j].lastMode = Number(spl[i++]||0);
        stockList.Goods[j].lastDur = Number(spl[i++]||0);
        stockList.Goods[j].unchangedDur = Number(spl[i++]||0);
        stockList.Goods[j].dropCount = Number(spl[i++]||0);
        stockList.Goods[j].riseCount = Number(spl[i++]||0);
        stockList.Goods[j].profit = Number(spl[i++]||0);
        stockList.Goods[j].someSold = !!(+spl[i++]||0);
        stockList.Goods[j].someBought = !!(+spl[i++]||0);
    }

    stockList.Start = Number(spl[i++]||0);
    stockList.lastTime = Number(spl[i++]||0);
    stockList.startingProfits = Number(spl[i++]||0);
    stockList.Profits = Number(spl[i++]||0);
    stockList.netProfits = Number(spl[i++]||0);
    stockList.grossProfits = Number(spl[i++]||0);
    stockList.grossLosses = Number(spl[i++]||0);
    stockList.totalStocks = Number(spl[i++]||0);
    stockList.totalShares = Number(spl[i++]||0);
    stockList.totalValue = Number(spl[i++]||0);
    stockList.unrealizedProfits = Number(spl[i++]||0);
    stockList.profitableStocks = Number(spl[i++]||0);
    stockList.unprofitableStocks = Number(spl[i++]||0);
    stockList.profitableTrades = Number(spl[i++]||0);
    stockList.unprofitableTrades = Number(spl[i++]||0);
    stockList.Purchases = Number(spl[i++]||0);
    stockList.Sales = Number(spl[i++]||0);
    stockList.Uptime = Number(spl[i++]||0);
    stockList.hourlyProfits = Number(spl[i++]||0);
    stockList.dailyProfits = Number(spl[i++]||0);

    // tail (new format)
    stockList.minCookies = Number(spl[i++]||0);
    stockList.maxCookies = Number(spl[i++]||0);
    stockList.noModActions = !!(+spl[i++]||0);
    stockList.origCookiesPsRawHighest = Number(spl[i++]||0);

    for (j=0;j<stockerModeProfits.length;j++)
        for (k=0;k<stockerModeProfits[j].length;k++)
            for (m=0;m<stockerModeProfits[j][k].length;m++)
                stockerModeProfits[j][k][m] = Number(spl[i++]||0);

    CookiStocker.ensureAchievements();
    var t = +spl[i++]; if (Game.Achievements['Plasmic assets']) Game.Achievements['Plasmic assets'].won = (t===1?1:0);
        t = +spl[i++]; if (Game.Achievements['Bose-Einstein Condensed Assets']) Game.Achievements['Bose-Einstein Condensed Assets'].won = (t===1?1:0);

    if (cfg){
        if ('stockerAutoTrading' in cfg) stockerAutoTrading = !!cfg.stockerAutoTrading;
        if ('stockerMarketOn' in cfg) stockerMarketOn = !!cfg.stockerMarketOn;
        if ('stockerMinBrokers' in cfg) stockerMinBrokers = +cfg.stockerMinBrokers|0;
        if ('stockerCookiesThreshold' in cfg) stockerCookiesThreshold = +cfg.stockerCookiesThreshold;
        if ('stockerAutoBuyMinimumBrokers' in cfg) stockerAutoBuyMinimumBrokers = !!cfg.stockerAutoBuyMinimumBrokers;
        if ('stockerAutoBuyAdditionalBrokers' in cfg) stockerAutoBuyAdditionalBrokers = !!cfg.stockerAutoBuyAdditionalBrokers;
        if ('stockerResourcesWarning' in cfg) stockerResourcesWarning = !!cfg.stockerResourcesWarning;
        if ('stockerExponential' in cfg) stockerExponential = !!cfg.stockerExponential;
        if ('stockerExponentialPower' in cfg) stockerExponentialPower = +cfg.stockerExponentialPower || 1.0;
        if ('stockerTransactionNotifications' in cfg) stockerTransactionNotifications = !!cfg.stockerTransactionNotifications;
        if ('stockerActivityReport' in cfg) stockerActivityReport = !!cfg.stockerActivityReport;
        if ('stockerActivityReportFrequency' in cfg) stockerActivityReportFrequency = Math.max(1000, +cfg.stockerActivityReportFrequency||3600000);
        if ('stockerFastNotifications' in cfg) stockerFastNotifications = !!cfg.stockerFastNotifications;
        if ('stockerConsoleAnnouncements' in cfg) stockerConsoleAnnouncements = !!cfg.stockerConsoleAnnouncements;
        if ('stockerAdditionalTradingStats' in cfg) stockerAdditionalTradingStats = !!cfg.stockerAdditionalTradingStats;
        if ('stockerLoopFrequency' in cfg) stockerLoopFrequency = Math.max(1000, +cfg.stockerLoopFrequency||30000);
        if ('stockerForceLoopUpdates' in cfg) stockerForceLoopUpdates = !!cfg.stockerForceLoopUpdates;

        // clamp
        if (!(+stockerCookiesThreshold>0 && +stockerCookiesThreshold<=1 && isFinite(+stockerCookiesThreshold))) stockerCookiesThreshold = 0.05;
        stockerMinBrokers = Math.max(0, Math.min(162, +stockerMinBrokers||0));

        // mirror to state
        CookiStocker.state.stockerAutoTrading = +!!stockerAutoTrading;
        CookiStocker.state.stockerMarketOn = +!!stockerMarketOn;
        CookiStocker.state.stockerAutoBuyMinimumBrokers = +!!stockerAutoBuyMinimumBrokers;
        CookiStocker.state.stockerAutoBuyAdditionalBrokers = +!!stockerAutoBuyAdditionalBrokers;
        CookiStocker.state.stockerResourcesWarning = +!!stockerResourcesWarning;
        CookiStocker.state.stockerExponential = +!!stockerExponential;
        CookiStocker.state.stockerTransactionNotifications = +!!stockerTransactionNotifications;
        CookiStocker.state.stockerActivityReport = +!!stockerActivityReport;
        CookiStocker.state.stockerFastNotifications = +!!stockerFastNotifications;
        CookiStocker.state.stockerConsoleAnnouncements = +!!stockerConsoleAnnouncements;
        CookiStocker.state.stockerAdditionalTradingStats = +!!stockerAdditionalTradingStats;
        CookiStocker.state.stockerForceLoopUpdates = +!!stockerForceLoopUpdates;

        CookiStocker.ensureReportTimer();
        CookiStocker.updateAdditionalStatsVisibility();
    }

    if (l('bankHeader')) CookiStocker.TradingStats();
    return true;
};

CookiStocker.reset = function(hard){
    if (!CookiStocker.Bank) return;
    if (CookiStocker._loopTimer){ clearInterval(CookiStocker._loopTimer); CookiStocker._loopTimer=0; }
    let market = CookiStocker.Bank.goodsById;

    stockList.Goods = [];
    for (let i=0;i<market.length;i++){
        stockList.Goods.push({
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
    }
    stockList.Start = Date.now()+500;
    stockList.lastTime = Date.now()+500;
    stockList.startingProfits = 0;
    stockList.Profits = 0;
    stockList.netProfits = 0;
    stockList.grossProfits = 0;
    stockList.grossLosses = 0;
    stockList.totalStocks = 0;
    stockList.totalShares = 0;
    stockList.totalValue = 0;
    stockList.unrealizedProfits = 0;
    stockList.profitableStocks = 0;
    stockList.unprofitableStocks = 0;
    stockList.profitableTrades = 0;
    stockList.unprofitableTrades = 0;
    stockList.Purchases = 0;
    stockList.Sales = 0;
    stockList.Uptime = 0;
    stockList.hourlyProfits = 0;
    stockList.dailyProfits = 0;
    stockList.minCookies = Number.MAX_VALUE;
    stockList.maxCookies = 0;
    stockList.noModActions = true;
    stockList.Amount = 0;

    for (let i=0;i<6;i++) for (let j=0;j<6;j++) for (let k=0;k<3;k++) stockerModeProfits[i][j][k]=0;

    if (CookiStocker._tickTimeout){ clearTimeout(CookiStocker._tickTimeout); CookiStocker._tickTimeout=0; }
    if (CookiStocker._reportTimeout){ clearTimeout(CookiStocker._reportTimeout); CookiStocker._reportTimeout=0; }

    if (hard){
        stockerMarketOn = true;
        stockList.origCookiesPsRawHighest = 0;
        if (Game.Achievements['Plasmic assets']) Game.Achievements['Plasmic assets'].won = 0;
        if (Game.Achievements['Bose-Einstein Condensed Assets']) Game.Achievements['Bose-Einstein Condensed Assets'].won = 0;
    }
};

/* ===================== Mod registration ===================== */

Game.registerMod('CookiStocker', {
    init: function(){
        Game.registerHook('reset', function(hard){ CookiStocker.reset(hard); });

        // Delay wiring menus until CCSE APIs are present
        (function waitCCSE(tries){
            if (typeof CCSE!=='undefined'
                && typeof CCSE.AppendCollapsibleOptionsMenu==='function'
                && typeof CCSE.AppendStatsVersionNumber==='function'){
                try { CookiStocker.ReplaceGameMenu(); }
                catch(e){
                    console.warn('[CookiStocker] ReplaceGameMenu failed; will retry shortly:', e);
                    setTimeout(function(){ waitCCSE(tries-1); }, 250);
                    return;
                }
            } else if (tries > 0){
                setTimeout(function(){ waitCCSE(tries-1); }, 250);
            } else {
                console.warn('[CookiStocker] CCSE not detected; Options/Stats menu will not be installed.');
            }
        })(120);

        Game.Notify('CookiStocker is loaded', stockerGreeting, [1, 33], false);

        // Start once Bank is there; patching is re-entrant-safe
        this.startStocking();
    },

    save: function(){ return CookiStocker.save(); },

    load: function(str){
        var tries = 0;
        (function tryLoad(){
            var bankReady = typeof Game==='object' && Game.ready && Game.Objects && Game.Objects['Bank'] && Game.Objects['Bank'].minigame && stockList.Goods.length>=0;
            if (bankReady){
                try {
                    if (!CookiStocker.Bank) CookiStocker.Bank = Game.Objects['Bank'].minigame;
                    CookiStocker.load(str||'');
                } catch(e){
                    console.warn('[CookiStocker] load failed:', e);
                }
            } else {
                if (tries++ < 120) setTimeout(tryLoad, 250);
                else console.warn('[CookiStocker] load skipped (Bank minigame never became ready).');
            }
        })();
    },

    startStocking: CookiStocker.startStocking,
});
