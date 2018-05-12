// Use strict mode globally
"use strict";

// This script assumes UI toolkit dependencies are already loaded into the page
const X_DIM = 0;
const Y_DIM = 1;

// The Pong jQuery object, we load it only once the QR layer is completed by the user.
// This object would not be necessary if compatible local file mode wasn't needed, but as it requires use of iframes,
// its DOM is only accessible from a special attribute, so this provides an abstraction to hold the object in each mode.
var g_PongObj = null;

// X and Y size ratios from auth QR canvas to game playable area
var g_playBoundsRatios = [1, 1];

// This indicates if apply fallback mechanisms due to security policy restrictions when accessing through local files
var g_bRunInLocalCompatMode = false;

var g_CompatModeDisplay = "Hemos detectado que accedes a la página desde los archivos de tu ordenador. "
    + "¡No hay problema! Hemos habilitado unos mecanismos alternativos para que puedas utilizar la Web correctamente.";

// Cached QR image URL of live session user
var g_qrImgUrl = null;

$(function () {
    function onQRUserDetected(event, result) {
        if (g_PongObj != null) {
            // Calculate Pong player's block position thanks to the top left QR coordinate, bottom right QR coordinate,
            // and the QR video-to-Pong video dimensions ratio
            var x = ((result.points[0].x + result.points[1].x) * g_playBoundsRatios[X_DIM] / 2);
            var y = ((result.points[0].y + result.points[1].y) * g_playBoundsRatios[Y_DIM] / 2);

            if (g_bRunInLocalCompatMode) {
                // Send user QR image to fill player block
                var encodedArray = JSON.stringify(['set_player_block_image', '<img src="' + g_qrImgUrl + '" />']);
                g_PongObj.postMessage(encodedArray, '*');

                // Send player coordinates to the Pong game
                encodedArray = JSON.stringify(['external_move_player_block', x, y]);
                g_PongObj.postMessage(encodedArray, '*');
            } else {
                // Fill player block with user QR image
                g_PongObj.$('#bloque_jugador').html('<img src="' + g_qrImgUrl + '" />');

                // Send player coordinates to the Pong game
                g_PongObj.$('body').trigger('externalMove', [x, y]);
            }
        }
    }

    // Purpose: Clear Pong player block's image with plain old color if no valid user was detected this frame via QR
    function onInvalidQRUserCurFrame(event) {
        if (g_PongObj != null) {
            if (g_bRunInLocalCompatMode) {
                g_PongObj.postMessage(JSON.stringify(['set_player_block_image', ""]), '*');
            } else {
                g_PongObj.$('#bloque_jugador').html("");
            }
        }
    }

    // Set the dividend in playbounds ratio, that is, the Pong video dimensions
    function handlePongVideoDimensions(width, height) {
        g_playBoundsRatios[X_DIM] *= width;
        g_playBoundsRatios[Y_DIM] *= height;
    }

    // Callback when QR auth + welcome screens are completed by the user
    function onQRStepsCompleted(event, qrImgUrl) {
        g_qrImgUrl = qrImgUrl;

        if (g_bRunInLocalCompatMode === true) {
            // Classical load failed. We load the fallback Pong game layer by setting a proper src...
            $('#pong-game-html-fallback-wrapper').prop('src', 'JuegoPongCamara/index.html');

            // ...And wait for it to fully load
            $('#pong-game-html-fallback-wrapper').on('load', function () {
                // First, place this view in front
                $(this).css('z-index', 1053);

                g_PongObj = $(this)[0].contentWindow;
            });
        } else {
            // Classical load
            $('#pong-game-html-wrapper').load('JuegoPongCamara/index.html', function () {
                // First, place this view in front
                $(this).css('z-index', 1053);

                g_PongObj = $(this);
                handlePongVideoDimensions(g_PongObj.$('#video_camara').width(), g_PongObj.$('#video_camara').height());
            });
        }
    }

    function onQRAuthLayerLoaded() {
        // Set the divisor in playbounds ratio, that is, the QR video dimensions
        g_playBoundsRatios[X_DIM] /= $('#qr-canvas').width();
        g_playBoundsRatios[Y_DIM] /= $('#qr-canvas').height();

        // Listen for the distinct events that will be sent by the QR auth layer
        $(document).on('qr_steps_completed', onQRStepsCompleted);
        $(document).on('qr_user_detected', onQRUserDetected);
        $(document).on('qr_user_invalid_or_undetected', onInvalidQRUserCurFrame);
    }

    // Try the classical load
    $('#qr-auth-html-wrapper').load('qr-auth.html', function (responseText, textStatus) {
        if (textStatus === "error") {
            g_bRunInLocalCompatMode = true;
            $('#denied-protocol-alert').html(g_CompatModeDisplay);
            $('#denied-protocol-alert').show();

            // We load the compat QR auth layer by setting a proper src...
            $('#qr-auth-html-fallback-wrapper').prop('src', 'qr-auth.html');

            // ...And wait for it to fully load
            $('#qr-auth-html-fallback-wrapper').on('load', function (responseText, textStatus) {
                onQRAuthLayerLoaded();
            });
        } else {
            g_bRunInLocalCompatMode = false;
            onQRAuthLayerLoaded();
        }
    });

    $('#denied-protocol-alert').click(function () {
        $(this).toggle();
    });

    //////////////////////////////////////////////////////////////////////
    ////////////               Iframe fallbacks               ////////////
    //////////////////////////////////////////////////////////////////////

    // Format of messages: An array containing a message name which identifies each one, followed by the message data.
    // In other words: ['message name', message-specific data/format]
    function onIFrameMsg(event) {
        var dataArray = JSON.parse(event.data);
        var name = dataArray[0];

        switch (name) {
            case "pong_video_dimensions":
                {
                    handlePongVideoDimensions(dataArray[1], dataArray[2]);
                    break;
                }
            case 'qr_steps_completed':
                {
                    onQRStepsCompleted(event, dataArray[1]);
                    break;
                }
            case 'qr_user_detected':
                {
                    onQRUserDetected(event, dataArray[1]);
                    break;
                }
            case 'qr_user_invalid_or_undetected':
                {
                    onInvalidQRUserCurFrame(event);
                    break;
                }
        }
    }

    window.addEventListener('message', onIFrameMsg, false);
});
