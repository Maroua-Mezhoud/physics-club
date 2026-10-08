const joinButton = document.querySelector(".join-button");

console.log(joinButton);

joinButton.addEventListener("click", function () {

    if (joinButton.classList.contains("joined")) {
        joinButton.textContent = "Join PHYSICS CLUB";
        joinButton.classList.remove("joined");
    } else {
        joinButton.textContent = "✓ JOINED";
        joinButton.classList.add("joined");
    }

});