
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

function FORMAT_STATUS_SELF_TIMELINE( wStatus ) {
	var finalStatus = "";
	if ( wStatus.retweeted_status ) {
		finalStatus = finalStatus + "@" + wStatus.retweeted_status.user.screen_name + " ";
		finalStatus = finalStatus + wStatus.retweeted_status.text + " ";
		finalStatus = finalStatus + TWITTER_STATUS_BASE + wStatus.retweeted_status.user.screen_name + TWITTER_STATUS_BASE_P2 + wStatus.retweeted_status.id_str;
	}
	else {
		finalStatus = finalStatus + wStatus.text + " ";
	}
	return finalStatus;
}

function FORMAT_STATUS_FOLLOWERS_TIMELINE( wStatus ) {
	var finalStatus = "";
	if ( wStatus.retweeted_status ) {
		finalStatus = finalStatus + "@" + wStatus.retweeted_status.user.screen_name + " ";
		finalStatus = finalStatus + wStatus.retweeted_status.text + " ";
		finalStatus = finalStatus + TWITTER_STATUS_BASE + wStatus.retweeted_status.user.screen_name + TWITTER_STATUS_BASE_P2 + wStatus.retweeted_status.id_str;
	}
	else {
		finalStatus = finalStatus + "@" + wStatus.user.screen_name + " ";
		finalStatus = finalStatus + wStatus.text + " ";
		finalStatus = finalStatus + TWITTER_STATUS_BASE + wStatus.user.screen_name + TWITTER_STATUS_BASE_P2 + wStatus.id_str;
	}
	return finalStatus;
}

function MASTODON_POST_SELF_TIMELINE( wStatus ) {
	const NewStatus = FORMAT_STATUS_SELF_TIMELINE( wStatus );
	console.log( "\n" + "SELF-TIMELINE\n" );
	console.log( NewStatus );
	MASTODON_POST_STATUS( wMastadonSelfClient , NewStatus );
}

function MASTODON_POST_FOLLOWERS_TIMELINE( wStatus ) {
	const NewStatus = FORMAT_STATUS_FOLLOWERS_TIMELINE( wStatus );
	console.log( "\n" + "FOLLOWERS-TIMELINE\n" );
	console.log( NewStatus );
	MASTODON_POST_STATUS( wMastadonFollowerClient , NewStatus );
}

( async ()=> {

	wMastadonSelfClient = new Masto( MastoSelfCreds );
	wMastadonFollowerClient = new Masto( MastoFollowerCreds );
	
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
			// Handle a disconnection
			MASTODON_POST_STATUS( wMastadonSelfClient , "Twitter Feed - OFFLINE" );
		});
		stream.on( "destroy" , function ( response ) {
			MASTODON_POST_STATUS( wMastadonSelfClient , "Twitter Feed - OFFLINE" );
		});
	});

})();