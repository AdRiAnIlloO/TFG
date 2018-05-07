// Use strict mode globally
"use strict";

// This script assumes UI toolkit dependencies are already loaded into the page
const X_DIM = 0;
const Y_DIM = 1;

// The Pong jQuery object, we load it only once the QR layer is completed by the user
var $g_PongjQuery = null;

// X and Y size ratios from auth QR canvas to game playable area
var g_playBoundsRatios = [1, 1];

// This indicates if apply fallback mechanisms due to security policy restrictions when using the file:/// protocol
var g_bRunInLocalCompatMode = false;

//var g_DeniedProtocolDisplay = "Por tu seguridad, el navegador ha bloqueado el acceso a la pantalla de autenticación. "
//    + "Si deseas visualizarla, consulta cómo desactivar el filtro de seguridad local en tu navegador";

var g_CompatModeDisplay = "Hemos detectado que accedes a la página desde los archivos de tu ordenador. "
    + "¡No hay problema! Hemos habilitado unos mecanismos alternativos para que puedas utilizar la Web correctamente.";

$(function () {
    if (location.protocol.startsWith('http://') || location.protocol.startsWith('https://')) {
        g_bRunInLocalCompatMode = false;
    } else {
        g_bRunInLocalCompatMode = true;
        $('#denied-protocol-alert').html(g_CompatModeDisplay);
        $('#denied-protocol-alert').show();
    }

    function onQRUserDetected(event, result) {
        if ($g_PongjQuery != null) {
            // Calculate Pong player's block position thanks to the top left QR coordinate, bottom right QR coordinate,
            // and the QR video-to-Pong video dimensions ratio
            var x = ((result.points[0].x + result.points[1].x) * g_playBoundsRatios[X_DIM] / 2);
            var y = ((result.points[0].y + result.points[1].y) * g_playBoundsRatios[Y_DIM] / 2);

            // Fill player block with user QR image
            $g_PongjQuery.$('#bloque_jugador').html('<img src="' + qrImgURL + '" />');

            // Send player coordinates to the pong game
            $g_PongjQuery.$('body').trigger('externalMove', [x, y]);
        }
    }

    // Here $g_PongjQuery must have been assigned already
    function onPongGameLoaded() {
        g_playBoundsRatios[X_DIM] *= $g_PongjQuery.$('#video_camara').width();
        g_playBoundsRatios[Y_DIM] *= $g_PongjQuery.$('#video_camara').height();
    }

    // Callback when QR auth + welcome screens are completed by the user
    function onQRStepsCompleted(event, qrImgURL) {
        // Fill player block with user QR image
        $g_PongjQuery.$('#bloque_jugador').html('<img src="' + qrImgURL + '" />');

        if (g_bRunInLocalCompatMode === true) {
            // We load the pong game layer by setting a propper src...
            $('#pong-game-html-fallback-wrapper').prop('src', 'JuegoPongCamara/index.html');

            // ...And wait for it to fully load
            $('#pong-game-html-fallback-wrapper').on('load', function () {
                $g_PongjQuery = $(this)[0].contentWindow;
                onPongGameLoaded();
            });
        } else {
            // Classical load
            $('#pong-game-html-fallback-wrapper').load('JuegoPongCamara/index.html', function () {
                $g_PongjQuery = $(this);
                onPongGameLoaded();
            });
        }
    }

    function onQRAuthLayerLoaded() {
        // Set the divisor in playbounds ratio, that is, the QR video dimensions
        g_playBoundsRatios[X_DIM] /= $('#qr-canvas').width();
        g_playBoundsRatios[Y_DIM] /= $('#qr-canvas').height();

        // Listen for the distinct events that will be sent by the QR auth layer
        $(document).on('qrStepsCompleted', onQRStepsCompleted);
        $(document).on('qrUserDetected', onQRUserDetected);
    }

    if (g_bRunInLocalCompatMode == true) {
        // We load the compat QR auth layer by setting a propper src...
        $('#qr-auth-html-fallback-wrapper').prop('src', 'qr-auth.html');

        // ...And wait for it to fully load
        $('#qr-auth-html-fallback-wrapper').on('load', function (responseText, textStatus) {
            onQRAuthLayerLoaded();
        });
    } else {
        // Classical load
        $('#qr-auth-html-wrapper').load('qr-auth.html', function (responseText, textStatus) {
            onQRAuthLayerLoaded();
        });
    }

    $('#denied-protocol-alert').click(function () {
        $(this).toggle();
    });
});
