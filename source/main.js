

terminal_write_line('INITIATING...');

function main() {
	function startAfterLoadImage() {
		terminal_hide();
		renderer_bind_image(this);
		next_level(() => { game.tick(); });
	}

	function startAfterLine() {
		renderer_init();		
		game.loadImage('q2', startAfterLoadImage);
	}

	function startAfterClick() {
		game.doc.onclick = null;
		terminal_cancel();
		terminal_write_line('INITIATING...', startAfterLine);
	}

	function startAfterAudio() {
		game.doc.onclick = startAfterClick;
		terminal_run_intro();
	}

	// audio_init(startAfterAudio);
	startAfterAudio();
}

main();
