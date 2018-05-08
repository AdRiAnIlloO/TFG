// Use strict mode globally
"use strict";

$(function () {
    function setUpQRGeneration(userName, userPassHash) {
        $('#qr-gen-modal').modal();
        $('#qr-gen-modal .modal-title').html("¡Hola, " + userName
            + "! Con el código que se muestra abajo podrás acceder mostrándolo a la cámara cuando vuelvas a conectarte."
            + " Sugerencia: fotografíalo.");
        $('#qr-gen-auth-code').prop('src', "https://chart.googleapis.com/chart?cht=qr&chs=256x256&chl=" + userPassHash);
    }

    $('#qr-gen-modal-close-btn').click(function () {
        $('#qr-gen-modal').modal('hide');
        $(document).trigger('qrStepsCompleted', [$('#qr-gen-auth-code').prop('src')]);
    });

    // Input: e - message containing array of the form of [User name, user password hash]
    function onSetUpQRGenerationMsg(e) {
        var dataArray = JSON.parse(e.data);
        var userName = dataArray[0];
        var userPassHash = dataArray[1];
        setUpQRGeneration(userName, userPassHash);
    }

    // Listen to messages from parent window.
    // Assumming it's a message with user for setUpQRGeneration.
    window.addEventListener('message', onSetUpQRGenerationMsg, false);
})
