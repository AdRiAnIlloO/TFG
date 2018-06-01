// Use strict mode globally
"use strict";

// This script assumes UI toolkit dependencies are already loaded into the page
const X_DIM = 0;
const Y_DIM = 1;

const QR_SIDE_TO_INTERPOINTS_DIST_RATIO = (29 / 23);

// The Pong jQuery object, we load it only once the QR layer is completed by the user.
var g_PongObj = null;

var g_QrCaptureDims = Array(2);
var g_PongToQrCaptureDimsRatio = [1, 1];

var g_CompatModeDisplay = "Hemos detectado que accedes a la página desde los archivos de tu ordenador. "
    + "¡No hay problema! Hemos habilitado unos mecanismos alternativos para que puedas utilizar la Web correctamente.";

// Cached QR image URL of live session user
var g_qrImgUrl = null;

$(function () {
    function onQRUserDetected(event, result) {
        if (g_PongObj != null) {
            // This block will calculate Pong player's block transformations

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

            bottomLeftPoint.x *= g_PongToQrCaptureDimsRatio[X_DIM];
            bottomLeftPoint.y *= g_PongToQrCaptureDimsRatio[Y_DIM];
            topLeftPoint.x *= g_PongToQrCaptureDimsRatio[X_DIM];
            topLeftPoint.y *= g_PongToQrCaptureDimsRatio[Y_DIM];
            topRightPoint.x *= g_PongToQrCaptureDimsRatio[X_DIM];
            topRightPoint.y *= g_PongToQrCaptureDimsRatio[Y_DIM];

            // Step 1: Calc central point of inner QR box and AABB collision box.
            // This is correct on all QR angles only when using the bottom left
            // and the top right point as delimiters.
            let centralPoint = [
                (bottomLeftPoint.x + topRightPoint.x) / 2,
                (bottomLeftPoint.y + topRightPoint.y) / 2
            ];

            // Step 2: Prepare vectors of both QR box sides
            let vecQRSides = [
                // Vector between top right - top left point (as if QR code was aligned with camera).
                // This one is used to calc angle later.
                [
                    (topLeftPoint.x - topRightPoint.x),
                    (topRightPoint.y - topLeftPoint.y)
                ],
                // Vector between bottom left - top left point, when placed right
                [
                    (topLeftPoint.x - bottomLeftPoint.x),
                    (bottomLeftPoint.y - topLeftPoint.y)
                ]
            ];

            if (isInMirrorMode) {
                // Mirror mode inverts horizontal dimension.
                // Adjust this to calc correct rotation.
                vecQRSides[0][X_DIM] *= -1;
            }

            // Step 3: Calc inner QR box's rotation
            let qrRotation = Math.atan2(
                vecQRSides[0][Y_DIM], vecQRSides[0][X_DIM]
            );

            // ...and the length of its sides (horizontal & vertical, if QR code was aligned with camera)
            // The length results should always be positive
            let qrSidesLength = [
                vecQRSides[0][X_DIM] / Math.cos(qrRotation),
                vecQRSides[1][X_DIM] / Math.cos(
                    Math.atan2(vecQRSides[1][Y_DIM], vecQRSides[1][X_DIM])
                )
            ];

            // Step 4: Calc side lengths of the AABB box
            let collisionBoxSidesLength = [
                Math.abs(vecQRSides[0][X_DIM]) + Math.abs(vecQRSides[1][X_DIM]),
                Math.abs(vecQRSides[0][Y_DIM]) + Math.abs(vecQRSides[1][Y_DIM])
            ];

            // Pong needs the following data: the QR image URL, the closest
            // point of AABB to the screen origin (top left), the distances to
            // the shared center (half AABB sides), the prerotated QR box length
            // of horizontal and vertical sides, and the rotation of it
            var encodedArray = JSON.stringify(['transform_player_block_from_qr',
                isInMirrorMode, g_qrImgUrl, centralPoint,
                collisionBoxSidesLength, qrSidesLength, qrRotation]);
            g_PongObj.postMessage(encodedArray, '*');
        }
    }

    // Purpose: Clear Pong player block's image with plain old color if no valid user was detected this frame via QR
    function onInvalidQRUserCurFrame(event) {
        if (g_PongObj != null) {
            // g_PongObj.postMessage(JSON.stringify(['clear_player_block']), '*');
        }
    }

    // Set the dividend in playbounds ratio, that is, the Pong video dimensions
    function handlePongVideoDimensions(width, height) {
        g_PongToQrCaptureDimsRatio[X_DIM] = width / g_QrCaptureDims[X_DIM];
        g_PongToQrCaptureDimsRatio[Y_DIM] = height / g_QrCaptureDims[Y_DIM];
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
                g_PongObj = $('#pong-game-html-wrapper')[0].contentWindow;

                // Set Pong execution mode without self camera tracking (it will be done by this layer)
                g_PongObj.postMessage(JSON.stringify(['set_external_camera_tracking']), '*');

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
