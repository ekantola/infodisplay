/*globals jQuery */

(function($, config) {
    var now = new Date();

    /*global*/ i18n = {};
    i18n.lang = config.LANG || 'en';

    $('document').append('<script src="translations/' + i18n.lang + '/translation.js"></script>');

    /*
     * Time formatting, displaying and friends
     */

    function repeat(str, count) {
        var outStr = '';
        for (var i=0; i<count; ++i) {
            outStr += str;
        }
        return outStr;
    }

    function lpad(obj, padding, minCount) {
        var str = '' + obj;
        return (str.length < minCount) ? (repeat(padding, minCount-str.length) + str) : str;
    }

    function toTimeElem(number) {
        return lpad(number, '0', 2);
    }

    function formatTime(hours, minutes, seconds) {
        var str = toTimeElem(hours);
        // Using '!=' to compare with null is intentional. The following comparisons are functionally equivalent:
        //
        // minutes != null
        // (function(undefined) { return minutes === undefined || minutes === null; }())
        if (minutes != null) {
            str += ':' + toTimeElem(minutes);
        }
        if (seconds != null) {
            str += ':' + toTimeElem(seconds);
        }
        return str;
    }

    function formatHourMinTime(date) {
        return formatTime(date.getHours(), date.getMinutes());
    }

    function updateTime() {
        now = new Date();
        $('#date').text(('' + now).substring(0, 10));
        $('#time').text(formatHourMinTime(now));
    }

    /*
     * Bus schedules
     */

    function diffMinutesToStr(diffMinutes) {
        var hours = Math.floor(diffMinutes / 60);
        var minStr = ' min'; //(diffMinutes%60 === 1) ? " min" : " mins";
        if (false /*hours > 0*/) {
            return hours + 'h' + diffMinutes%60 + minStr;
        } else {
            return diffMinutes + minStr;
        }
    }

    function populateTable(stopConfig, arrivalData, maxDepartures) {
        var tableId = 'stop_' + stopConfig.id;
        var table = $('#' + tableId);
        if (table.length === 0) {
            $('#schedules').append(
                '<h2>' + stopConfig.name + ' <span>(' + stopConfig.description + ')</span></h2>' +
                '<table id="' + tableId + '" class="arrivalDataTable"></table>');
            table = $('#' + tableId);
        } else {
            table.empty();
        }

        var total = 0;
        for (var i=0; i<arrivalData.length && total<maxDepartures; i++) {
            var item = arrivalData[i];
            var stopTime = formatHourMinTime(item.time);
            var diffTime = Math.round((item.time - now) / (1000*60));
            if (diffTime > 0) {
                table.append(
                    '<tr><td class="line">' + item.busLineName + '</td>' +
                    '<td class="destination">' + /*item.destination +*/ (item.busLineName == 501 ? 'Espoo' : 'Helsinki') + '</td>' +
                    '<td class="diffTime">' + diffMinutesToStr(diffTime) + '</td>' +
                    '<td class="stopTime">' + stopTime + '</td></tr>');
                total++;
            }
            if (i >= arrivalData.length) {
                break;
            }
        }
    }

    function isTrueData(evaluateItem, savedItems) {
        if (!savedItems || !savedItems.length) {
            return true;
        }

        for (var i=0; i<savedItems.length; ++i) {
            var item = savedItems[i];
            var timeDiff = (evaluateItem.time.getHours()*60 + evaluateItem.time.getMinutes()) - (item.time.getHours()*60 + item.time.getMinutes());
            if (evaluateItem.busLineName === item.busLineName && (timeDiff <= config.intervals.busTimeLimitMins)) {
                return false;
            }
        }

        return true;
    }

    function getReittiopasStopData(apiData) {
        var lines = apiData.split('\n'),
            returnData = [];

        for (var i=1; i<lines.length; ++i) {
            var line = lines[i];
            if (line && line.length && line.length > 1) {
                var data = line.split('|');
                var time = lpad(data[0], '0', 4);
                var hour = parseInt(time.substring(0, 2), 10);
                var minute = parseInt(time.substring(2, 4), 10);
                var isTomorrow = 0;
                if (hour > 23) {
                    isTomorrow = 1;
                    hour = hour - 24;
                }

                var atStop = new Date(now.getFullYear(), now.getMonth(), now.getDate()+isTomorrow, hour, minute, 0);
                var diffMinutes = (atStop.getTime() - now.getTime()) / (1000*60);

                data = {
                    minutes: diffMinutes,
                    time: atStop,
                    busLineName: data[1],
                    destination: data[2]
                };

                if (isTrueData(data, returnData)) {
                    returnData[returnData.length] = data;
                }
            }
        }

        return returnData;
    }

    function refreshBusStop(stopConfig) {
        return function(data) {
            populateTable(
                stopConfig,
                getReittiopasStopData(data),
                stopConfig.maxDepartures || config.defaults.maxDepartures);
        };
    }

    function refreshBusStops(stops) {
        $('#schedules').empty();
        for (var i=0; i<stops.length; i++) {
            var stop = stops[i];
            $.get(config.reittiopas.baseUrl + stop.id, refreshBusStop(stop));
        }
    }

    /*
     * Weather
     */

    function refreshWeatherForecastForCity(location) {
        $.get(config.weatherbug.baseUrl, {
            ACode: config.weatherbug.apiCode,
            unittype: 1,
            citycode: location.code
        }, function(data) {
            var desc = $(data).find('item:first').find('description:first');
            // Turn the CDATA content into jQuery DOM object, wrapping it inside a div first to make find() work
            var descDOM = $('<div>' + desc.text() + '</div>');
            var img = descDOM.find('img:first');
            var imgUrl = img.length && img[0].src;
            // Extract temperatures
            var temp;
            var childNodes = descDOM[0].childNodes; // argh, need to use DOM here :(
            for (var i=0, length=childNodes.length, element; i<length; i++) {
                element = childNodes[i];
                if (element.data && ('' + element.data).indexOf('°C') >= 0) {
                    temp = parseInt(element.data, 10);
                    break;
                }
            }

            // Update image and temp in UI
            var forecast = $('#weather' + location.name);
            forecast.find('.conditions img').attr('src', imgUrl);
            forecast.find('.temp .value').text(temp);
        });
    }

    function refreshWeatherForecasts(locations) {
        for(var i = 0; i < locations.length; i++) {
            refreshWeatherForecastForCity(locations[i]);
        }
    }

    /*
     * Other
     */

    $(document).ready(function() {
        // Localizations
        $('[i18n]').each(function() {
            var elem = $(this);
            var key = elem.attr('i18n');
            var value = i18n[key];
            if (value) {
                elem.text(value);
            } else {
                //console.log('No good: ' + key);
            }
        });

        setInterval(updateTime, config.intervals.clockUpdate);

        refreshWeatherForecasts(config.weatherbug.locations);
        setInterval(refreshWeatherForecasts, config.intervals.weatherRefresh, config.weatherbug.locations);

        refreshBusStops(config.reittiopas.stops);
        setInterval(refreshBusStops, config.intervals.busScheduleRefresh, config.reittiopas.stops);

        if (config.taxi) {
          if (config.taxi.sms) {
            $('#taxi_address').text(config.taxi.sms.address);
            $('#taxi_smsnumber').text(config.taxi.sms.number);
            $('#taxi_sms').show();
          }
          if (config.taxi.phone) {
            if (config.taxi.sms) {
              $('#taxi_or').show();
            }
            $('#taxi_phonenumber').text(config.taxi.phone);
            $('#taxi_phone').show();
          }
          $('#taxi').show();
        }
    });
}(jQuery, infodisplayConfig));
