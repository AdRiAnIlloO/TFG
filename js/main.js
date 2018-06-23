// Use strict mode globally
"use strict";

// This script assumes UI toolkit dependencies are already loaded into the page
const X_DIM = 0;
const Y_DIM = 1;

// The Pong jQuery object, we load it only once the QR layer is completed by the user.
var g_PongObj = null;

var g_QrCaptureDims = Array(2);
var g_QrCaptureAspectRatio = null;

var g_CompatModeDisplay = "Hemos detectado que accedes a la página desde los archivos de tu ordenador. "
    + "¡No hay problema! Hemos habilitado unos mecanismos alternativos para que puedas utilizar la Web correctamente.";

// Cached QR image URL of live session user
var g_qrImgUrl = null;

$(function () {
    function onQRUserDetected(event, userSessionSlot, result) {
        if (g_PongObj != null) {
            let bottomLeftPoint = result.points[0],
                topLeftPoint = result.points[1],
                topRightPoint = result.points[2];

            // TODO: Add dynamic mirror mode selection. When this is false, we
            // want to reverse the horizontal coordinates, to play intuitively.
            let isInMirrorMode = false;

            if (!isInMirrorMode) {
                bottomLeftPoint.x = g_QrCaptureDims[X_DIM] - bottomLeftPoint.x;
                topLeftPoint.x = g_QrCaptureDims[X_DIM] - topLeftPoint.x;
                topRightPoint.x = g_QrCaptureDims[X_DIM] - topRightPoint.x;
            }

            // Send event to Pong with the data it needs for transformations
            var encodedArray = JSON.stringify(['transform_player_block_from_qr',
                userSessionSlot, isInMirrorMode, g_qrImgUrl, g_QrCaptureAspectRatio,
                g_QrCaptureDims, bottomLeftPoint, topLeftPoint,
                topRightPoint]);
            g_PongObj.postMessage(encodedArray, '*');
        }
    }

    // Purpose: Clear Pong player block's image with plain old color if no valid user was detected this frame via QR
    function onInvalidQRUserCurFrame(event) {
        if (g_PongObj != null) {
            // g_PongObj.postMessage(JSON.stringify(['clear_player_block']), '*');
        }
    }

    // Callback when QR auth + welcome screens are completed by the user
    function onQRStepsCompleted(event, qrImgUrl) {
        g_qrImgUrl = qrImgUrl;

        // We load the fallback Pong game layer by setting a proper src...
        $('#pong-game-html-wrapper').prop('src', 'JuegoPongCamara/index.html');

        // ...And wait for it to partially load
        $('#pong-game-html-wrapper').on('load', function () {
            // First, make it visible
            $(this).css('visibility', 'visible');
        });
    }

    function handleQRVideoDimensions(aspectRatio, width, height) {
        g_QrCaptureAspectRatio = aspectRatio;
        g_QrCaptureDims[X_DIM] = width;
        g_QrCaptureDims[Y_DIM] = height;
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
            case 'add_session_user_slot': {
                $('#qr-auth-html-wrapper')[0].contentWindow.postMessage(
                    JSON.stringify([name]), '*'
                );
                break;
            }
            case 'pong_game_loaded': {
                g_PongObj = $('#pong-game-html-wrapper')[0].contentWindow;

                // Set Pong execution mode without self camera tracking (it will be done by this layer)
                g_PongObj.postMessage(JSON.stringify(['set_external_camera_tracking']), '*');

                break;
            } case 'qr_auth_video_dimensions': {
                handleQRVideoDimensions(dataArray[1], dataArray[2],
                    dataArray[3]);
                break;
            } case 'qr_steps_completed': {
                onQRStepsCompleted(event, dataArray[1]);
                break;
            } case 'qr_user_detected': {
                onQRUserDetected(event, dataArray[1], dataArray[2]);
                break;
            } case 'qr_user_invalid_or_undetected': {
                onInvalidQRUserCurFrame(event);
                break;
            }
        }
    }

    window.addEventListener('message', onIFrameMsg, false);
});
