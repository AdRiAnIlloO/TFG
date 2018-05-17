// Use strict mode globally
"use strict";

// This script assumes UI toolkit dependencies are already loaded into the page
const X_DIM = 0;
const Y_DIM = 1;

// The Pong jQuery object, we load it only once the QR layer is completed by the user.
var g_PongObj = null;

// Cached dimensions of ongoing videos
var g_QrCaptureDims = Array(2);
var g_PongCaptureDims = Array(2);

var g_CompatModeDisplay = "Hemos detectado que accedes a la página desde los archivos de tu ordenador. "
    + "¡No hay problema! Hemos habilitado unos mecanismos alternativos para que puedas utilizar la Web correctamente.";

// Cached QR image URL of live session user
var g_qrImgUrl = null;

$(function () {
    function onQRUserDetected(event, result) {
        if (g_PongObj != null) {
            // Calculate Pong player's block position thanks to the bottom left QR point (result.points[0]),
            // top left QR point (result.points[1]), top right QR point (results.point[2]), and the QR video-to-Pong
            // video dimensions ratio
            var ratios = [g_PongCaptureDims[X_DIM] / g_QrCaptureDims[X_DIM],
                g_PongCaptureDims[Y_DIM] / g_QrCaptureDims[Y_DIM]];
            var x = g_PongCaptureDims[X_DIM] - ((result.points[1].x + result.points[2].x) * ratios[X_DIM] / 2);
            var y = ((result.points[1].y + result.points[0].y) * ratios[Y_DIM] / 2);

            // Send user QR image to fill player block
            var encodedArray = JSON.stringify(['set_player_block_image', g_qrImgUrl]);
            g_PongObj.postMessage(encodedArray, '*');

            // Send scanned QR dimensions to Pong game for dynamic sizing
            encodedArray = JSON.stringify(['resize_player_block',
                (result.points[2].x - result.points[1].x) * ratios[X_DIM]]);
            g_PongObj.postMessage(encodedArray, '*');

            // Send player coordinates to the Pong game
            encodedArray = JSON.stringify(['external_move_player_block', x, y]);
            g_PongObj.postMessage(encodedArray, '*');
        }
    }

    // Purpose: Clear Pong player block's image with plain old color if no valid user was detected this frame via QR
    function onInvalidQRUserCurFrame(event) {
        if (g_PongObj != null) {
            g_PongObj.postMessage(JSON.stringify(['clear_player_block']), '*');
        }
    }

    // Set the dividend in playbounds ratio, that is, the Pong video dimensions
    function handlePongVideoDimensions(width, height) {
        g_PongCaptureDims[X_DIM] = width;
        g_PongCaptureDims[Y_DIM] = height;
    }

    // Callback when QR auth + welcome screens are completed by the user
    function onQRStepsCompleted(event, qrImgUrl) {
        g_qrImgUrl = qrImgUrl;

        // We load the fallback Pong game layer by setting a proper src...
        $('#pong-game-html-wrapper').prop('src', 'JuegoPongCamara/index.html');

        // ...And wait for it to fully load
        $('#pong-game-html-wrapper').on('load', function () {
            // First, make it visible
            $(this).css('visibility', 'visible');

            g_PongObj = $(this)[0].contentWindow;

            // Set Pong execution mode without self camera tracking (it will be done by this layer)
            g_PongObj.postMessage(JSON.stringify(['set_external_camera_tracking']), '*');
        });
    }

    function handleQRVideoDimensions(qrCanvasWidth, qrCanvasHeight) {
        // Set the divisor in playbounds ratio, that is, the QR video dimensions
        g_QrCaptureDims[X_DIM] = qrCanvasWidth;
        g_QrCaptureDims[Y_DIM] = qrCanvasHeight;
    }

    if (window.location.href.indexOf('file:///') == 0) {
        $('#denied-protocol-alert').html(g_CompatModeDisplay);
        $('#denied-protocol-alert').show();
    }

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
            case "pong_video_dimensions": {
                handlePongVideoDimensions(dataArray[1], dataArray[2]);
                break;
            } case 'qr_auth_video_dimensions': {
                handleQRVideoDimensions(dataArray[1], dataArray[2]);
                break;
            } case 'qr_steps_completed': {
                onQRStepsCompleted(event, dataArray[1]);
                break;
            } case 'qr_user_detected': {
                onQRUserDetected(event, dataArray[1]);
                break;
            } case 'qr_user_invalid_or_undetected': {
                onInvalidQRUserCurFrame(event);
                break;
            }
        }
    }

    window.addEventListener('message', onIFrameMsg, false);
});
