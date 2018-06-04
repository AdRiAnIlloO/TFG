// Use strict mode globally
"use strict";

// Heuristic timeout to consider video capture as stopped while not receiving any 'ontimeupdate' event of it
// In normal conditions, 'ontimeupdate' is fired around each 250 ms as much
const CANVAS_COPY_TIMEOUT_MS = 1000; // 1 second

// Global authed User instance
var g_AuthedUser = null;

// Authentications error, checked against null for advancing authentication form
var g_AuthErrorMsg = null;

// Console logging?
var g_isInDebug = false;

// Time in ms. after which to stop copying video to canvas
var g_MsTimeToStopCanvasCopy = 0;

function User(name, pass, encodedAuth) {
    if (encodedAuth == null) {
        this.name = name;
        this.setHashFromPlainPass(pass);
    } else {
        var authData = encodedAuth.split(" ");
        this.name = authData[0];
        this.passHash = authData[1];
    }
}

// Section of User functions that are defined once and shared across instances
{
    User.prototype.setHashFromPlainPass = function (pass) {
        this.passHash = new Hashes.MD5().hex(pass);
    }

    // Return an encoded auth to be embedded in QR
    User.prototype.buildEncodedAuth = function () {
        return (this.name + " " + this.passHash);
    }
}

// Return an array of registered users from browser session.
// JSON can at least transport attributes (but not functions!)
function getSessionUsers() {
    return (JSON.parse(window.sessionStorage.getItem('users')) || []);
}

// Add an User to the registered users array of session storage
function addSessionUser(user) {
    var users = getSessionUsers();
    users.push(user);
    window.sessionStorage.setItem('users', JSON.stringify(users));
}

// Returns a registered User instance whose name matches the parameter, null if not found
function findSessionUserByName(name) {
    var users = getSessionUsers();
    var foundUser = null;

    users.forEach(function (user) {
        if (user.name === name) {
            foundUser = user;
            return;
        }
    });

    return foundUser;
}

function hasLocalStorage() {
    return window.Storage;
}

// Document is ready, callback
$(function () {
    $('#auth-popup').modal();

    if (hasLocalStorage()) {
        $('#login').click(function () {
            var jsonUser = findSessionUserByName($('input[name=user]').val());

            if (jsonUser != null) {
                var auxUser = new User(jsonUser.name, $('input[name=pass]').val());

                if (auxUser.passHash == jsonUser.passHash) {
                    g_AuthedUser = auxUser;
                    g_AuthErrorMsg = null;
                } else {
                    g_AuthErrorMsg = "Error de acceso: credenciales inválidas";
                }
            } else {
                g_AuthErrorMsg = "Error de acceso: usuario no registrado";
            }

            // To prevent submit action-chain from executing, return false
        });

        $('#register').click(function () {
            var inputName = $('input[name=user]').val();
            g_AuthedUser = findSessionUserByName(inputName);

            if (g_AuthedUser == null) {
                g_AuthedUser = new User(inputName, $('input[name=pass]').val());
                addSessionUser(g_AuthedUser);
                g_AuthErrorMsg = null;
            } else {
                g_AuthErrorMsg = "Error de acceso: usuario ya existente";
            }

            // To prevent submit action-chain from executing, return false
        });
    }

    // This is called for both form authentications and QR scans access.
    function onUserAuthenticated() {
        $('#auth-popup').modal('hide');

        // This is required to allow user clicking in the next modal (generated QR welcome screen)
        $('#collapsible-capture-feedback').hide();

        // We load the fallback welcome QR generation screen by setting a proper src
        $('#qr-code-gen-html-wrapper').prop('src', 'qr-code-gen.html');

        window.addEventListener('message', function (event) {
            var dataArray = JSON.parse(event.data);
            var name = dataArray[0];

            switch (name) {
                case 'qr_generation_ready': {
                    // buildEncodedAuth is not serializable, since it's a function. Send the encoded auth already:
                    var qrGenScreenObj = $('#qr-code-gen-html-wrapper')[0].contentWindow;
                    qrGenScreenObj.postMessage(JSON.stringify(['set_up_qr_generation', g_AuthedUser.name,
                        g_AuthedUser.buildEncodedAuth()]), '*');
                    break;
                } case 'qr_steps_completed': {
                    // Forward this event to the parent window from the layer below current iframe
                    window.parent.postMessage(event.data, '*');
                    break;
                }
            }
        }, false);
    }

    $('#auth-form').submit(function (event) {
        event.preventDefault(); // Prevent reload page (always)

        if (g_AuthErrorMsg != null) {
            $('#auth-errors').show();
            $('#auth-errors').html(g_AuthErrorMsg);
        } else {
            onUserAuthenticated();
        }
    });

    var $preview = $('#preview');
    var $qrCanvas = $('#qr-canvas');
    var showLiveCaptureTxt = $('#collapse-capture-btn div').html();

    // Modify the live capture user-interactable section
    $('#collapse-capture-btn').click(function () {
        $qrCanvas.toggle();

        if ($qrCanvas.is(':hidden')) {
            $(this).children('div').html(showLiveCaptureTxt);
        } else {
            $(this).children('div').html('Ocultar captura en vivo');
        }

        // Set appropiate icon
        $(this).children('i').first().toggleClass('fa-expand');
        $(this).children('i').first().toggleClass('fa-compress');
    });

    // Copy captured image to canvas and scan QR from it (jsqrcode library requires it)
    function captureToCanvas_ScanQR() {
        var context = $qrCanvas[0].getContext('2d');
        var width = $qrCanvas.width();
        var height = $qrCanvas.height();
        context.drawImage($preview[0], 0, 0, width, height);

        try {
            // jsqrcode specific code
            qrcode.decode();
        } catch (error) {
            window.parent.postMessage(JSON.stringify(['qr_user_invalid_or_undetected']), '*');
        }

        if (g_MsTimeToStopCanvasCopy > Date.now()) {
            // This should call browser API function if it exists, or setTimeout otherwise (each 16 ms)
            // One advantage of native function is callback is not fired when no animation is rendering in screen.
            // This optimizations happens when being in a different tab, for example.
            // This needs to be requested on each frame for the next one
            _requestAnimationFrame(captureToCanvas_ScanQR);
        } else {
            console.log("Error: video element recently stopped receiving camera data");
            window.parent.postMessage(JSON.stringify(['qr_user_invalid_or_undetected']), '*');
        }
    }

    $preview[0].onplay = function () {
        g_MsTimeToStopCanvasCopy = Date.now() + CANVAS_COPY_TIMEOUT_MS;
        captureToCanvas_ScanQR();
    };

    $preview[0].ontimeupdate = function () {
        g_MsTimeToStopCanvasCopy = Date.now() + CANVAS_COPY_TIMEOUT_MS;
    };

    // Init video, in the hope that a natural camera resolution will be used
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(function (stream) {
            let settings = stream.getTracks()[0].getSettings();
            let captureWidth = settings.width;
            let captureHeight = settings.height;

            // We copy the resulting capture height to the canvas height.
            // Using dimensions to natural resolution makes QR detection faster.
            let canvasWidth = $qrCanvas.width();
            let canvasHeight = canvasWidth / settings.aspectRatio;
            $qrCanvas.prop('height', canvasHeight);

            // Copy it to the CSS too, it's necessary to keep canvas working when
            // this view (QR authentication) is placed behind other view via z-index
            $qrCanvas.height(canvasHeight);

            // Inform the main layer of the QR video dimensions
            window.parent.postMessage(JSON.stringify(['qr_auth_video_dimensions',
                settings.aspectRatio, canvasWidth, canvasHeight]), '*');

            $('#preview').prop('srcObject', stream);
            $('#preview')[0].play();
        }).catch(function (e) {
            console.log(e.name + ": " + e.message);
        });

    // jsqrcode specific code - result of the scanning of the embedded QR canvas
    // This function respects possible User already authenticated, without overriding it
    qrcode.callback = function (result) {
        if (g_isInDebug) {
            console.log("Scanned QR code decoded string = " + result.decodedStr);

            var context = $qrCanvas[0].getContext('2d');
            context.arc(result.points[0].x, result.points[0].y, 5, 0, 2 * Math.PI);
            context.fillStyle = "yellow";
            context.fill();
            context.beginPath();
            context.arc(result.points[1].x, result.points[1].y, 5, 0, 2 * Math.PI);
            context.fillStyle = "orange";
            context.fill();
            context.beginPath();
            context.arc(result.points[2].x, result.points[2].y, 5, 0, 2 * Math.PI);
            context.fillStyle = "red";
            context.fill();
            return;
        }

        var auxUser = new User(null, null, result.decodedStr);

        // Are we in a live user session already?
        if (g_AuthedUser != null) {
            // Yes. Credentials of checked QR user must match with the session user's.
            if (auxUser.passHash !== g_AuthedUser.passHash) {
                // Full credentials are incorrect
                throw 'qr_user_invalid';
            }
        } else {
            // No live session is active. Search for a registered user with that name.
            var foundUser = findSessionUserByName(auxUser.name);

            if (foundUser == null) {
                // No registered user found with that name
                throw 'qr_user_undetected';
            }

            if (foundUser.passHash !== auxUser.passHash) {
                // Full credentials are incorrect
                throw 'qr_user_invalid';
            }

            // Pass user authentication via QR
            g_AuthErrorMsg = null;
            g_AuthedUser = auxUser;
            onUserAuthenticated();
        }

        // Send message about that an existing user was detected and validated in this frame via QR.
        // Pay special attention that data must be wrapped in an array.
        window.parent.postMessage(JSON.stringify(['qr_user_detected', result]), '*');
    };

    //////////////////////////////////////////////////////////////////////
    ////////////               Iframe fallbacks               ////////////
    //////////////////////////////////////////////////////////////////////
})
