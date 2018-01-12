const twitter = require( "ntwitter" );
const TwitterCreds = require( "./personal.js" ).twitter_creds;
const twit = new twitter( TwitterCreds );
const MyTwitterUserName = require( "./personal.js" ).twitter_username;
const TWITTER_STATUS_BASE = "https://twitter.com/";
const TWITTER_STATUS_BASE_P2 = "/status/";

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
			await slackClient.post( wStatus , "#msync-err" );
			resolve();
		}
		catch( error ) { console.log( error ); reject( error ); }
	});
}

const resolver = require( "resolver" );
function RESOLVE_LINK( wURL ) {
	return new Promise( async function( resolve , reject ) {
		try {
			resolver.resolve( wURL , function( err , url , filename , contentType ) {
				if ( !err ) { resolve( url ); }
				else { resolve( wURL ); }
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
			wText = wText.split( " " );
			for ( var i = 0; i < wText.length; ++i ) {
				const x1_idx = wText[ i ].indexOf( "http" ); 
				if ( x1_idx !== -1 ) {
					console.log( "We Found a Short Link" );
					console.log( wText[ i ] );
					wText[ i ] = await RESOLVE_LINK( wText[ i ] );
					console.log( wText[ i ] );
				}
				wFinal = wFinal + wText[ i ] + " ";
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
				const wText = await SCAN_TEXT_AND_RESOLVE_LINKS( wStatus.retweeted_status.text );
				finalStatus = finalStatus + wText + " ";
				finalStatus = finalStatus + TWITTER_STATUS_BASE + wStatus.retweeted_status.user.screen_name + TWITTER_STATUS_BASE_P2 + wStatus.retweeted_status.id_str;
			}
			else {
				const wText = await SCAN_TEXT_AND_RESOLVE_LINKS( wStatus.text );
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
				const wText = await SCAN_TEXT_AND_RESOLVE_LINKS( wStatus.retweeted_status.text );
				finalStatus = finalStatus + wText + " ";
				finalStatus = finalStatus + TWITTER_STATUS_BASE + wStatus.retweeted_status.user.screen_name + TWITTER_STATUS_BASE_P2 + wStatus.retweeted_status.id_str;
			}
			else {
				finalStatus = finalStatus + "@" + wStatus.user.screen_name + " ";
				const wText = await SCAN_TEXT_AND_RESOLVE_LINKS( wStatus.text );
				finalStatus = finalStatus + wText + " ";
				finalStatus = finalStatus + TWITTER_STATUS_BASE + wStatus.user.screen_name + TWITTER_STATUS_BASE_P2 + wStatus.id_str;
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
			resolve();
		}
		catch( error ) { console.log( error ); reject( error ); }
	});
}

( async ()=> {

	wMastadonSelfClient = new Masto( MastoSelfCreds );
	wMastadonFollowerClient = new Masto( MastoFollowerCreds );
	bot = await new Slack( { wToken } );

	process.on( "unhandledRejection" , function( reason , p ) {
		var xPrps = Object.keys( reason );
		console.log( xPrps );
		console.error( reason , "Unhandled Rejection at Promise" , p );
		console.trace();
		POST_SLACK_ERROR( reason );
	});
	process.on( "uncaughtException" , function( err ) {
		console.error( err , "Uncaught Exception thrown" );
		console.trace();
		POST_SLACK_ERROR( err );
	});
	
	twit.stream( "user" , function( stream ) {
		stream.on( "data" , function ( data ) {
			if ( data.id ) {
				if ( data.user.screen_name === MyTwitterUserName ) {
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

})();