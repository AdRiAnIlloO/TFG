// Use strict mode globally
"use strict";

// This indicates if apply fallback mechanisms due to security policy restrictions when accessing through local files
var g_bRunInLocalCompatMode = false;

$(function () {
    function setUpQRGeneration(userName, userEncodedAuth) {
        $('#qr-gen-modal').modal();
        $('#qr-gen-modal .modal-title').html("¡Hola, " + userName
            + "! Con el código que se muestra abajo podrás acceder mostrándolo a la cámara cuando vuelvas a conectarte."
            + " Sugerencia: fotografíalo.");
        $('#qr-gen-auth-code').prop('src', "https://chart.googleapis.com/chart?cht=qr&chs=256x256&chl="
            + userEncodedAuth);
    }

    $('#qr-gen-modal-close-btn').click(function () {
        $('#qr-gen-modal').modal('hide');

        if (g_bRunInLocalCompatMode) {
            window.parent.postMessage(JSON.stringify(['qr_steps_completed', $('#qr-gen-auth-code').prop('src')]), '*');
        } else {
            $(document).trigger('qr_steps_completed', [$('#qr-gen-auth-code').prop('src')]);
        }
    });

    // Input: e - message containing array of the form of [User name, user encoded auth]
    function onSetUpQRGenerationMsg(e) {
        g_bRunInLocalCompatMode = true; // Message came when using iframes for local file execution compatibility
        var dataArray = JSON.parse(e.data);
        var userName = dataArray[0];
        var userEncodedAuth = dataArray[1];
        setUpQRGeneration(userName, userEncodedAuth);
    }

    //////////////////////////////////////////////////////////////////////
    ////////////               Iframe fallbacks               ////////////
    //////////////////////////////////////////////////////////////////////

    // Listen to messages from parent window.
    // Assumming it's a message with user for setUpQRGeneration.
    window.addEventListener('message', onSetUpQRGenerationMsg, false);
})
