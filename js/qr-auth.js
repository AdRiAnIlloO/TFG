// Use strict mode globally
"use strict";

// Heuristic timeout to consider video capture as stopped while not receiving any 'ontimeupdate' event of it
// In normal conditions, 'ontimeupdate' is fired around each 250 ms as much
const CANVAS_COPY_TIMEOUT_MS = 1000; // 1 second

const X_DIM = 0;
const Y_DIM = 1;

let g_MaxSessionUserSlots = 1;

// Global registered and in-session users
let g_AuthedUsers = [];

// Authentications error, checked against null for advancing authentication form
var g_AuthErrorMsg = null;

// Console logging?
var g_IsInDebug = false;

// This is used to filter out already attached cameras if we request further
let g_AttachedCamsIdString = [];

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
function findRegisteredUserByName(name) {
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
            var jsonUser = findRegisteredUserByName($('input[name=user]').val());

            if (jsonUser != null) {
                var auxUser = new User(jsonUser.name, $('input[name=pass]').val());

                if (auxUser.passHash == jsonUser.passHash) {
                    g_AuthedUsers.push(auxUser);
                    g_AuthErrorMsg = null;
                } else {
                    g_AuthErrorMsg = "Error de acceso: credenciales inválidas";
                }
            } else {
                g_AuthErrorMsg = "Error de acceso: usuario no registrado";
            }

            // NOTE: To prevent submit action-chain from executing, return false
        });

        $('#register').click(function () {
            var inputName = $('input[name=user]').val();
            let registeredUser = findRegisteredUserByName(inputName);

            if (registeredUser == null) {
                registeredUser = new User(inputName, $('input[name=pass]').val());
                g_AuthedUsers.push(registeredUser);
                addSessionUser(registeredUser);
                g_AuthErrorMsg = null;
            } else {
                g_AuthErrorMsg = "Error de acceso: usuario ya existente";
            }

            // To prevent submit action-chain from executing, return false
        });
    }

    // This is called for both form authentications and QR scans access.
    function onMainUserAuthenticated() {
        $('#auth-popup').modal('hide');

        // This is required to allow user clicking in the next modal (generated QR welcome screen)
        $('#collapsible-capture-feedback').hide();

        // We load the fallback welcome QR generation screen by setting a proper src
        $('#qr-code-gen-html-wrapper').prop('src', 'qr-code-gen.html');
    }

    $('#auth-form').submit(function (event) {
        event.preventDefault(); // Prevent reload page (always)

        if (g_AuthErrorMsg != null) {
            $('#auth-errors').show();
            $('#auth-errors').html(g_AuthErrorMsg);
        } else {
            onMainUserAuthenticated();
        }
    });

    var $qrCanvas = $('#qr-canvas');
    var showLiveCaptureTxt = $('#collapse-capture-btn div').html();

    // This function first looks at the already logged in users, then at the
    // registered users, except if the session slots are full, where it stops.
    // Output: index of User in the session Users (-1 if failed)
    function authenticateUserFromDecodedString(decodedString) {
        var decodedUser = new User(null, null, decodedString);

        for (let i in g_AuthedUsers) {
            if (g_AuthedUsers[i].name === decodedUser.name) {
                if (decodedUser.passHash !== g_AuthedUsers[i].passHash) {
                    return -1;
                }

                // Pass user authentication via decoded string
                g_AuthErrorMsg = null;
                return i;
            }
        }

        if (g_AuthedUsers.length >= g_MaxSessionUserSlots) {
            return -1;
        }

        let registeredUser = findRegisteredUserByName(decodedUser.name);

        if (registeredUser == null) {
            return -1;
        }

        if (decodedUser.passHash !== registeredUser.passHash) {
            return -1;
        }

        // Pass user authentication via decoded string
        g_AuthErrorMsg = null;
        g_AuthedUsers.push(decodedUser);

        if (g_AuthedUsers.length == 1) {
            onMainUserAuthenticated();
        }

        return (g_AuthedUsers.length - 1);
    }

    function onAuthQrPhotoLoaded(image) {
        // Because JOB is asynchronous, block decoding from the camera stream
        $qrCanvas[0].isDecodingLocked = true;

        $qrCanvas.prop('width', image.width);
        $qrCanvas.prop('height', image.height);
        let context = $qrCanvas[0].getContext('2d');
        context.drawImage(image, 0, 0);

        JOB.SetImageCallback(function(result) {
            if (result.length > 0) {
                console.log("Scanned 1D barcode type = " + result[0].Format
                    + ". Decoded string = " + result[0].Value + ".");
                authenticateUserFromDecodedString(result[0].Value);
            } else {
                 // Fallback to jsqrcode library
                try {
                    qrcode.decode();
                } catch {
                    console.log("Error: failed to decode uploaded QR authentication photo file.");
                }
            }

            // Release lock to re-allow decoding from the camera stream
            $qrCanvas[0].isDecodingLocked = false;
        });

        JOB.DecodeImage(image);
    }

    function processAuthQrPhotoFile(dataUrl, fileType) {
        let image = new Image();
        image.src = dataUrl;

        image.onload = (() => onAuthQrPhotoLoaded(image));
    }

    function readAuthQrPhotoFile(file) {
        let reader = new FileReader();

        reader.onloadend = function() {
            processAuthQrPhotoFile(reader.result, file.type);
        }

        reader.onerror = function() {
            console.log("Error: failed to read uploaded QR authentication photo file. "
                + reader.error);
        }

        reader.readAsDataURL(file);
    }

    $('#image_upload_input').click(function() {
         // Allow to detect consecutive re-uploaded files with same name
        $(this).val("");
    });

    $('#image_upload_input').change(function(event) {
        let file = event.target.files[0];

        if (file != null) {
            readAuthQrPhotoFile(file);
        }
    });

    let $miniCamPreview = $('#mini_camera_preview');

    // Modify the live capture user-interactable section
    $('#collapse-capture-btn').click(function () {
        $miniCamPreview.toggle();

        if ($miniCamPreview.is(':hidden')) {
            $(this).children('div').html(showLiveCaptureTxt);
        } else {
            $(this).children('div').html('Ocultar captura en vivo');
        }

        // Set appropiate icon
        $(this).children('i').first().toggleClass('fa-expand');
        $(this).children('i').first().toggleClass('fa-compress');
    });

    function delayCanvasCopyTimeout(video) {
        video.nextCheckMsTime = Date.now() + CANVAS_COPY_TIMEOUT_MS;
    }

    function logStreamStopError($video) {
        if (!$video[0].isStreamStopLogged) {
            console.log("Error: video element with id: '" + $video.prop('id')
                + "' recently stopped receiving camera data");
            $video[0].isStreamStopLogged = true;
        }
    }

    // Copy captured image to canvas and scan QR from it (jsqrcode library requires it)
    function captureToCanvas_ScanQR() {
        // It is convenient to place this at the start, since this function time
        // advances even when doing the blocking operations below; avoid trouble
        let now = Date.now();

        let shouldRAF = true;
        let $videos = [$('#camera1_video'), $('#camera2_video')];

        // Reduce Video array to the Videos that should be processed
        $videos = $videos.filter(($video, index) => {
            if ($video[0].src == "" && $video[0].srcObject == null) {
                // Camera was never attached. Filter out Video.
                return false;
            }

            if ($video[0].captureStream && !$video[0].captureStream().active) {
                // Stream disconnected. Log error, filter out Video and mark to stop rAF.
                logStreamStopError($video);
                shouldRAF = false;
                return false;
            }

            if ($video[0].readyState !== $video[0].HAVE_ENOUGH_DATA) {
                // Image is not ready yet. Filter out Video.
                return false;
            }

            if (!$video[0].isCaptureInitializationHandled) {
                // Initialize the disconnect heuristical timeout
                delayCanvasCopyTimeout($video[0]);

                $video[0].isCaptureInitializationHandled = true;
                console.log("Camera image on video element with id: '" + $video.prop('id')
                    + "' took " + (now - $video[0].streamInitMsTime) + "ms to initialize");
            } else if (now >= $video[0].nextCheckMsTime) {
                logStreamStopError($video);
                shouldRAF = false;
                return false;
            }

            // Adequate the scanned Canvas to current Video and copy the image
            $qrCanvas.prop('width', $video.width());
            $qrCanvas.prop('height', $video.height());
            let context = $qrCanvas[0].getContext('2d');
            context.drawImage($video[0], 0, 0);

            // If there is an ongoing asynchronous operation for decoding a QR code
            // from an uploaded photo (handled by JOB), wait for it to complete
            if (!$qrCanvas[0].isDecodingLocked) {
                try {
                    $qrCanvas[0].videoIndex = index;

                    // jsqrcode specific code
                    qrcode.decode();
                } catch {
                    window.parent.postMessage(
                        JSON.stringify(['qr_user_invalid_or_undetected']), '*'
                    );
                }
            }

            return true;
        });

        if (shouldRAF) {
            // Is it suitable to copy the nearest valid capture to the mini preview Canvas?
            if ($videos.length > 0 && $miniCamPreview.is(':visible')) {
                let context = $miniCamPreview[0].getContext('2d');
                context.drawImage($videos[0][0], 0, 0, $miniCamPreview.width(),
                    $miniCamPreview.height());
            }

            // This should call browser API function if it exists, or setTimeout otherwise (each 16 ms)
            _requestAnimationFrame(captureToCanvas_ScanQR);
        }
    }

    $('#camera1_video')[0].onplay = captureToCanvas_ScanQR;

    $('#camera1_video')[0].ontimeupdate = function() {
        delayCanvasCopyTimeout(this); // NOTE: this would be undefined in lambda
    };

    $('#camera2_video')[0].ontimeupdate = function() {
        delayCanvasCopyTimeout(this); // NOTE: this would be undefined in lambda
    };

    // Fallback function for usage on older getUserMedia APIs
    // Input: $video - Optional (jQuery) wrapper of Video element to attach stream to
    function onCameraSuccessEx(stream, $video = $('#camera1_video')) {
        let settings = stream.getTracks()[0].getSettings();
        let cameraSlot = g_AttachedCamsIdString.length;
        g_AttachedCamsIdString.push(settings.deviceId);
        let captureWidth = settings.width;
        let captureHeight = settings.height;

        if ($video === $('camera1_video')) {
            // Calculate the height of the mini preview from retrieved height
            let canvasWidth = $miniCamPreview.width();
            let canvasHeight = canvasWidth / settings.aspectRatio;
            $miniCamPreview.prop('height', canvasHeight);
        }

        // Inform the main layer of the QR video dimensions
        window.parent.postMessage(JSON.stringify(['qr_auth_video_dimensions',
            settings.aspectRatio, captureWidth, captureHeight]), '*');

        // Assign the stream to the video. Provide fallback for older APIs.
        if (typeof($video.prop('srcObject')) === 'object') {
            $video.prop('srcObject', stream);
        } else {
            $video.prop('src', URL.createObjectURL(stream));
        }

        $video[0].streamInitMsTime = Date.now();
        $video[0].play();
    }

    // Fallback function for usage on older getUserMedia APIs
    function onCameraError(error) {
        console.log(error.name + ": " + error.message);
    }

    // Wrapped getUserMedia
    // Input: cameraIdString - Optional device id to request a specific camera
    // $video - Optional (jQuery) wrapper of Video element to attach stream to
    function wrappedGUM(cameraIdString, $video) {
        // Giving preference to newest API.
        // Correct prefix needs to be used to prevent context error (tested).
        let prefix = navigator.mediaDevices || navigator;

        // NOTE: It'd be a syntax error making a new variable out of a property.
        // Simply re-assign the existing property to the compatible API:
        prefix.getUserMedia = prefix.getUserMedia || prefix.mozGetUserMedia
            || prefix.webkitGetUserMedia || prefix.msGetUserMedia;

        // Init video, in the hope that a natural camera resolution will be used
        let retVal = prefix.getUserMedia({
            video: { deviceId: cameraIdString }, audio: false
        }, stream => onCameraSuccessEx(stream, $video), onCameraError);

        if (typeof(retVal) === 'object') {
            // Assumme returned value is a Promise from the newest getUserMedia API
            retVal.then(stream => onCameraSuccessEx(stream, $video))
            .catch(onCameraError);
        }
    }

    wrappedGUM();

    // jsqrcode specific code - result of the scanning of the embedded QR canvas
    qrcode.callback = function (result) {
        console.log("Scanned QR code decoded string = " + result.decodedStr);

        // Is it suitable to do debug drawings on the mini preview Canvas?
        if (
            $qrCanvas[0].videoIndex === 0 && $miniCamPreview.is(':visible')
            && g_IsInDebug
        ) {
            // Begin: Display points on the QR's finder points and exit
            let ratios = [
                $miniCamPreview.prop('width') / $qrCanvas.prop('width'),
                $miniCamPreview.prop('height') / $qrCanvas.prop('height')
            ];
            let context = $miniCamPreview[0].getContext('2d');
            let fillStyles = ['yellow', 'orange', 'red', 'magenta'];

            result.points.forEach((point, index) => {
                context.beginPath();
                context.arc(point.x * ratios[X_DIM],
                    point.y * ratios[Y_DIM], 5, 0, 2 * Math.PI);
                context.fillStyle = fillStyles[index];
                context.fill();
                context.closePath();
            });

            return;
        }

        let userSessionSlot = authenticateUserFromDecodedString(result.decodedStr);

        if (userSessionSlot != -1) {
            // Send message about that an existing user was detected and validated in this frame via QR.
            // Pay special attention that data must be wrapped in an array.
            window.parent.postMessage(JSON.stringify(['qr_user_detected',
                $qrCanvas[0].videoIndex, userSessionSlot, result]), '*');
        }
    };

    // Is DecoderWorker invalid still?
    let decoderWorker = null;

    try {
        // Try load correct located decoder Worker (may fail under cross-origin)
        decoderWorker = new Worker("thirdparty/JOB/exif.js");

        // Call mandatory EddieLa/JOB library function, as author states
        JOB.Init(decoderWorker, "thirdparty/JOB/exif.js");
    } catch {
        // Attempt to load the content of remote script
        $.get("https://eddiela.github.io/JOB/DecoderWorker.js", function(data) {
            // Allocate Worker from the data and via URL BLOB
            decoderWorker = new Worker(URL.createObjectURL(
                new Blob([data], {
                    type: 'text/javascript'
                })
            ));

            // Call mandatory EddieLa/JOB library function, as author states
            JOB.Init(decoderWorker, "thirdparty/JOB/exif.js");
        });
    }

    //////////////////////////////////////////////////////////////////////
    ////////////               Iframe fallbacks               ////////////
    //////////////////////////////////////////////////////////////////////

    window.addEventListener('message', function (event) {
        var dataArray = JSON.parse(event.data);
        var name = dataArray[0];

        switch (name) {
            case 'add_session_user_slot': {
                g_MaxSessionUserSlots++;

                if (navigator.mediaDevices.enumerateDevices == null) {
                    break;
                }

                navigator.mediaDevices.enumerateDevices()
                .then(function(devices) {
                    // NOTE: Processing a MediaDeviceInfo object
                    let secondaryCamera = devices.find(device => {
                        return (device.kind === 'videoinput'
                        && g_AttachedCamsIdString.indexOf(device.deviceId) == -1);
                    });

                    if (secondaryCamera != null) {
                        wrappedGUM(secondaryCamera.deviceId, $('#camera2_video'));
                    }
                });

                break;
            } case 'qr_generation_ready': {
                // buildEncodedAuth is not serializable, since it's a function. Send the encoded auth already:
                var qrGenScreenObj = $('#qr-code-gen-html-wrapper')[0].contentWindow;

                // Here, only pass the main User, which should be the first in session users
                qrGenScreenObj.postMessage(JSON.stringify([
                    'set_up_qr_generation', g_AuthedUsers[0].name,
                    g_AuthedUsers[0].buildEncodedAuth()]), '*');
                break;
            } case 'qr_steps_completed': {
                // Forward this event to the parent window from the layer below current iframe
                window.parent.postMessage(event.data, '*');
                break;
            }
        }
    }, false);
})
