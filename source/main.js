

terminal_write_line('INITIATING...');

function main() {
	function startAfterLoadImage() {
		const img = this;
		terminal_hide();
		renderer.bindImage(img);
		next_level(() => { game.tick(); });
	}

	function startAfterLine() {
		renderer.init();		
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
