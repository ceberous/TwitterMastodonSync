// https://github.com/AvianFlu/ntwitter
const twitter = require( "ntwitter" );
const TwitterMain = require( "./personal.js" ).twitter_main;
var twit = null;
const TwitterAutism = require( "./personal.js" ).twitter_autism;
var twitAutism = null;

const Eris = require("eris");
var discordAutism = null;
const discordAutismCreds = require( "./personal.js" ).DISCORD_AUTISM;
var discordTwitter = null;
const discordTwitterCreds = require( "./personal.js" ) .DISCORD_TWITTER;

const TWITTER_STATUS_BASE = "https://twitter.com/";
const TWITTER_STATUS_BASE_P2 = "/status/";

function W_SLEEP( ms ) { return new Promise( resolve => setTimeout( resolve , ms ) ); }
//function W_SLEEP( ms ) { return new Promise( resolve => setTimeout( resolve , ms ) ); }

const Masto = require( "mastodon" );
const MastoSelfCreds = require( "./personal.js" ).mastodon_self_creds;
const MastoFollowerCreds = require( "./personal.js" ).mastodon_follower_creds;
var wMastadonSelfClient = null;
var wMastadonFollowersClient = null;
function MASTODON_POST_STATUS( wClient , wStatus ) {
	return new Promise( async function( resolve , reject ) {
		try {
			await wClient.post( "statuses" , { status: wStatus });
			setTimeout( function() {	
				resolve();
			} , 2000 );
		}
		catch( error ) { console.log( error ); reject( error ); }
	});
}

const Slack = require( "slack" );
var bot = null;
const wToken = require( "./personal.js" ).SLACK_TOKEN;
function SLACK_POST_MESSAGE( wMessage , wChannel ) {
	return new Promise( async function( resolve , reject ) {
		try {
			await bot.chat.postMessage( { token: wToken , channel: wChannel , text: wMessage  } );
			resolve();
		}
		catch( error ) { console.log( error ); reject( error ); }
	});
}
function POST_SLACK_ERROR( wStatus ) {
	return new Promise( async function( resolve , reject ) {
		try {
			if ( typeof wStatus !== "string" ) {
				try { wStatus = wStatus.toString(); }
				catch( e ) { wStatus = e; }
			}
			await SLACK_POST_MESSAGE( wStatus , "#msync-err" );
			resolve();
		}
		catch( error ) { console.log( error ); reject( error ); }
	});
}

function RECONNECT_TWITTER_CLIENTS() {
	return new Promise( async function( resolve , reject ) {
		try {

			if ( twit !== null ) {
				if ( twit.stream !== null ) {
					if ( typeof twit.stream.destroySilent === "function" ) {
						twit.stream.destroySilent();
						await W_SLEEP( 1000 );
						twit = null;
					}
					else {
						twit = null;
						await W_SLEEP( 3000 );
					}
				}
			}

			if ( twitAutism !== null ) {
				if ( twitAutism.stream !== null ) {
					if ( typeof twitAutism.stream.destroySilent === "function" ) {
						twitAutism.stream.destroySilent();
						await W_SLEEP( 3000 );
						twitAutism = null;
					}
					else {
						twitAutism = null;
						await W_SLEEP( 3000 );
					}
				}
			}

			twit = new twitter( TwitterMain.creds );
			twitAutism = new twitter( TwitterAutism.creds );

			twit.stream( "user" , function( stream ) {
				stream.on( "data" , function ( data ) {
					if ( data.id ) {
						//console.log( data );
						if ( data.user.screen_name === TwitterMain.username ) {
							MASTODON_POST_SELF_TIMELINE( data );
						}
						else { MASTODON_POST_FOLLOWERS_TIMELINE( data ); }
					}
				});
				stream.on( "end" , function ( response ) {
					MASTODON_POST_STATUS( wMastadonSelfClient , "Twitter Feed - OFFLINE" );
				});
				stream.on( "destroy" , function ( response ) {
					MASTODON_POST_STATUS( wMastadonSelfClient , "Twitter Feed - OFFLINE" );
				});
			});

			twitAutism.stream( "user" , function( stream ) {
				stream.on( "data" , async function ( data ) {
					if ( data.id ) {
						//console.log( data );
						if ( data.user.screen_name !== TwitterAutism.username ) {
							const NewStatus = await FORMAT_STATUS_FOLLOWERS_TIMELINE( data );
							console.log( "\n" + "FOLLOWERS-TIMELINE\n" );
							console.log( NewStatus );
							await SLACK_POST_MESSAGE( NewStatus , "#tautism" );
							await discordAutism.createMessage( discordAutismCreds.channel_id , NewStatus );
						}
					}
				});
				stream.on( "end" , function ( response ) {
					MASTODON_POST_STATUS( wMastadonSelfClient , "Twitter Feed - OFFLINE" );
				});
				stream.on( "destroy" , function ( response ) {
					MASTODON_POST_STATUS( wMastadonSelfClient , "Twitter Feed - OFFLINE" );
				});
			});
			POST_SLACK_ERROR( "reconnected twitter clients" );
			resolve();
		}
		catch( error ) { console.log( error ); reject( error ); }
	});
}
module.exports.reconnectTwitterClients = RECONNECT_TWITTER_CLIENTS;


// https://stackoverflow.com/a/14646633/9222528
function CheckIsValidDomain(domain) { 
    var re = new RegExp(/^((?:(?:(?:\w[\.\-\+]?)*)\w)+)((?:(?:(?:\w[\.\-\+]?){0,62})\w)+)\.(\w{2,6})$/); 
    return domain.match(re);
}

const resolver = require( "resolver" );
function RESOLVE_LINK( wURL ) {
	return new Promise( async function( resolve , reject ) {
		try {
			console.log( "Trying to Resolve --> " );
			console.log( wURL );
			resolver.resolve( wURL , function( err , url , filename , contentType ) {
				if ( err ) { resolve( "fail" ); return; }
				if ( url === wURL ) { resolve( "fail" ); return; }
				resolve( url );
			});
		}
		catch( error ) { console.log( error ); reject( error ); }
	});
}

function SCAN_TEXT_AND_RESOLVE_LINKS( wText ) {
	return new Promise( async function( resolve , reject ) {
		try {
			if ( !wText ) { resolve( "" ); return; }
			var wFinal = "";
			var wAddonLinks = wText.split( "\n" );
			wText = wAddonLinks[ 0 ].split( " " );
			for ( var i = 0; i < wText.length; ++i ) {
				//console.log( i.toString() + ".) = " + wText[ i ] );
				const x1_idx = wText[ i ].indexOf( "http" ); 
				if ( x1_idx !== -1 ) {
					console.log( "We Found a Short Link" );
					wText[ i ] = wText[ i ].substring( x1_idx , wText[ i ].length );
					console.log( wText[ i ] );
					var j11 = await RESOLVE_LINK( wText[ i ] );
					if ( j11 === "fail" ) {
						var j12 = wText[ i ].substring( 0 , ( wText[ i ].length - 1 ) );
						console.log( j12 );
						j11 = await RESOLVE_LINK( j12 );
						if ( j11 === "fail" ) { j11 = wText[ i ]; }
					}
					wText[ i ] = j11;
					console.log( wText[ i ] );
				}
				if ( wText[ i ] !== "https://twitter.com/" ) {
					wFinal = wFinal + wText[ i ] + " ";
				}
			}
			for ( var i = 1; i < wAddonLinks.length; ++i ) {
				var xTemp = wAddonLinks[ i ].split( " " );
				for ( var j = 0; j < xTemp.length; ++j ) {
					const x2_idx = xTemp[ j ].indexOf( "http" ); 
					if ( x2_idx !== -1 ) {
						console.log( "We Found a Short Link" );
						xTemp[ j ] = await RESOLVE_LINK( xTemp[ j ] );
						console.log( xTemp[ j ] );
					}
					if ( xTemp[ j ] !== "https://twitter.com/" ) {
						wFinal = wFinal + xTemp[ j ] + " ";
					}
				}
			}
			resolve( wFinal );
		}
		catch( error ) { console.log( error ); reject( error ); }
	});
}

function FORMAT_STATUS_SELF_TIMELINE( wStatus ) {
	return new Promise( async function( resolve , reject ) {
		try {
			var finalStatus = "";
			if ( wStatus.retweeted_status ) {
				finalStatus = finalStatus + "@" + wStatus.retweeted_status.user.screen_name + " ";
				var wText = ( wStatus.retweeted_status.extended_tweet ) ? wStatus.retweeted_status.extended_tweet.full_text : wStatus.retweeted_status.text;
				wText = await SCAN_TEXT_AND_RESOLVE_LINKS( wText );
				wText = await SCAN_TEXT_AND_RESOLVE_LINKS( wText );
				finalStatus = finalStatus + wText + " ";
				if ( !finalStatus.indexOf( "/photo/" ) ) {
					finalStatus = finalStatus + TWITTER_STATUS_BASE + wStatus.retweeted_status.user.screen_name + TWITTER_STATUS_BASE_P2 + wStatus.retweeted_status.id_str;
				}
			}
			else {
				var wText = ( wStatus.extended_tweet ) ? wStatus.extended_tweet.full_text : wStatus.text;
				wText = await SCAN_TEXT_AND_RESOLVE_LINKS( wText );
				wText = await SCAN_TEXT_AND_RESOLVE_LINKS( wText );
				finalStatus = finalStatus + wText + " ";
			}
			resolve( finalStatus );
		}
		catch( error ) { console.log( error ); reject( error ); }
	});
}

function FORMAT_STATUS_FOLLOWERS_TIMELINE( wStatus ) {
	return new Promise( async function( resolve , reject ) {
		try {
			var finalStatus = "";
			if ( wStatus.retweeted_status ) {
				finalStatus = finalStatus + "@" + wStatus.retweeted_status.user.screen_name + " ";
				var wText = ( wStatus.retweeted_status.extended_tweet ) ? wStatus.retweeted_status.extended_tweet.full_text : wStatus.retweeted_status.text;
				wText = await SCAN_TEXT_AND_RESOLVE_LINKS( wText );
				wText = await SCAN_TEXT_AND_RESOLVE_LINKS( wText );
				finalStatus = finalStatus + wText + " ";
				if ( !finalStatus.indexOf( "/photo/" ) ) { 
					finalStatus = finalStatus + TWITTER_STATUS_BASE + wStatus.retweeted_status.user.screen_name + TWITTER_STATUS_BASE_P2 + wStatus.retweeted_status.id_str;
				}
			}
			else {
				finalStatus = finalStatus + "@" + wStatus.user.screen_name + " ";
				var wText = ( wStatus.extended_tweet ) ? wStatus.extended_tweet.full_text : wStatus.text;
				wText = await SCAN_TEXT_AND_RESOLVE_LINKS( wText );
				wText = await SCAN_TEXT_AND_RESOLVE_LINKS( wText );
				finalStatus = finalStatus + wText + " ";
				if ( !finalStatus.indexOf( "/photo/" ) ) {
					finalStatus = finalStatus + TWITTER_STATUS_BASE + wStatus.user.screen_name + TWITTER_STATUS_BASE_P2 + wStatus.id_str;
				}
			}
			resolve( finalStatus );
		}
		catch( error ) { console.log( error ); reject( error ); }
	});
}

function MASTODON_POST_SELF_TIMELINE( wStatus ) {
	return new Promise( async function( resolve , reject ) {
		try {
			const NewStatus = await FORMAT_STATUS_SELF_TIMELINE( wStatus );
			console.log( "\n" + "SELF-TIMELINE\n" );
			console.log( NewStatus );
			await MASTODON_POST_STATUS( wMastadonSelfClient , NewStatus );
			await SLACK_POST_MESSAGE( NewStatus , "#msync" );
			await discordTwitter.createMessage( discordTwitterCreds.channel_id , NewStatus );
			resolve();
		}
		catch( error ) { console.log( error ); reject( error ); }
	});
}

function MASTODON_POST_FOLLOWERS_TIMELINE( wStatus ) {
	return new Promise( async function( resolve , reject ) {
		try {
			const NewStatus = await FORMAT_STATUS_FOLLOWERS_TIMELINE( wStatus );
			console.log( "\n" + "FOLLOWERS-TIMELINE\n" );
			console.log( NewStatus );
			await MASTODON_POST_STATUS( wMastadonFollowerClient , NewStatus );
			await SLACK_POST_MESSAGE( NewStatus , "#tfeed" );
			resolve();
		}
		catch( error ) { console.log( error ); reject( error ); }
	});
}

( async ()=> {

	wMastadonSelfClient = new Masto( MastoSelfCreds );
	wMastadonFollowerClient = new Masto( MastoFollowerCreds );
	bot = await new Slack( { wToken } );

	discordAutism = new Eris( discordAutismCreds.token );
	discordTwitter = new Eris( discordTwitterCreds.token );
	await discordAutism.connect();
	await discordTwitter.connect();

	process.on( "unhandledRejection" , function( reason , p ) {
		var xPrps = Object.keys( reason );
		console.log( xPrps ); 
		console.error( reason , "Unhandled Rejection at Promise" , p );
		console.trace();
		if ( !reason ) { return; }
		if ( reason === "Error: read ECONNRESET" ) { RECONNECT_TWITTER_CLIENTS(); }
		POST_SLACK_ERROR( reason );
	});
	process.on( "uncaughtException" , function( err ) {
		console.error( err , "Uncaught Exception thrown" );
		console.trace();
		if ( !err ) { return; }
		const x11 = err.toString();
		if ( x11 === "Error: read ECONNRESET" ) {
			setTimeout( function() {
				//RECONNECT_TWITTER_CLIENTS();
			} , 3000 );
		}		
		POST_SLACK_ERROR( err );
	});
	
	RECONNECT_TWITTER_CLIENTS();
	POST_SLACK_ERROR( "main.js ---> init() --> completed" );
})();