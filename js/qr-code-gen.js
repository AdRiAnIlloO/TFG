// Use strict mode globally
"use strict";

// This indicates if apply fallback mechanisms due to security policy restrictions when accessing through local files
var g_bRunInLocalCompatMode = false;

function setUpQRGeneration(userName, userEncodedAuth) {
    $('#qr-gen-modal').modal();
    $('#qr-gen-modal .modal-title').html("¡Hola, " + userName
        + "! Con el código que se muestra abajo podrás acceder mostrándolo a la cámara cuando vuelvas a conectarte."
        + " Sugerencia: fotografíalo.");
    $('#qr-gen-auth-code').prop('src', "https://chart.googleapis.com/chart?cht=qr&chs=256x256&chl="
        + userEncodedAuth);
}

$(function () {
    $('#qr-gen-modal-close-btn').click(function () {
        $('#qr-gen-modal').modal('hide');

        if (g_bRunInLocalCompatMode) {
            window.parent.postMessage(JSON.stringify(['qr_steps_completed', $('#qr-gen-auth-code').prop('src')]), '*');
        } else {
            $(document).trigger('qr_steps_completed', [$('#qr-gen-auth-code').prop('src')]);
        }
    });

    //////////////////////////////////////////////////////////////////////
    ////////////               Iframe fallbacks               ////////////
    //////////////////////////////////////////////////////////////////////

    // Listen to messages from parent window.
    // Assumming it's a message with user for setUpQRGeneration.
    window.addEventListener('message', function (event) {
        var dataArray = JSON.parse(event.data);
        var name = dataArray[0];

        switch (name) {
            case 'set_up_qr_generation': {
                setUpQRGeneration(dataArray[1], dataArray[2]);
                break;
            } default: {
                // In case not running iframe compatibility mode, other events are received here aswell, need to avoid
                // setting the compatibility flag to true, as in below
                return;
            }
        }

        // Message came when using iframes for local file execution compatibility
        g_bRunInLocalCompatMode = true;
    }, false);
})
