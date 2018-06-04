// Use strict mode globally
"use strict";

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

        window.parent.postMessage(JSON.stringify(['qr_steps_completed', $('#qr-gen-auth-code').prop('src')]), '*');
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
            }
        }
    }, false);

    // This event ensures further postMessages will be always receiveable at this point
    window.parent.postMessage(JSON.stringify(['qr_generation_ready']), '*');
})
