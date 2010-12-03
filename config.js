/**
 * Common configuration
 */

var infodisplayConfig = {
    LANG: 'en',

    intervals: {
        clockUpdate: 100 /*0.1 secs*/,
        busScheduleRefresh: 1000*30 /*30 secs*/,
        busTimeLimitMins: 600,
        weatherRefresh: 1000*60*5 /*5 mins*/
    },

    defaults: {
        maxDepartures: 4
    }
};
