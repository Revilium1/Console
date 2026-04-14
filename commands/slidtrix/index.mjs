import { getScreen, clear, div } from "../../util/screens.js";
import alert from "../../util/alert.js";

function slidtrix() {
	clear();

	return new Promise(resolve => {
		let gameScreen = getScreen("slidtrix");
		let container = div(gameScreen, 'slidtrix-container');
		
		const onExit = () => {
			if (tickInterval) clearInterval(tickInterval);
			clear();
			resolve();
		};
		
		// Load the HTML content
		container.innerHTML = `
			<div style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; margin-top: 10px; user-select: none;">
				<h2 style="color: #0f0; margin: 0; font-size: 18px;">SLIDTRIX</h2>
				<p id="status" style="color: #0f0; margin: 5px 0; font-size: 12px;"></p>
				<div id="grid" style="color: #0f0; display: grid; grid-template-columns: repeat(10, 25px); grid-template-rows: repeat(10, 25px); gap: 1px; margin-bottom: 15px;"></div>
				<p style="color: #0f0; font-size: 10px; margin-top: 10px; text-align: center;">
					<strong>↑↓←→</strong> move • <strong>TAB</strong> play • <strong>R</strong> reset<br>
					Click edit • <strong>O</strong> save • <strong>P</strong> load • <strong>ESC</strong> exit
				</p>
			</div>
		`;

		// Initialize the game state
		const TILE_TYPES = ['wall', 'empty', 'start', 'end', 'sticky', 'conveyor-up', 'conveyor-down', 'conveyor-left', 'conveyor-right', 'trap', 'lava', 'portal'];
		const TILE_SYMBOLS = {
			wall: '#',
			empty: '.',
			start: '*',
			end: '~',
			sticky: '&',
			player: '@',
			'conveyor-up': '↑',
			'conveyor-down': '↓',
			'conveyor-left': '←',
			'conveyor-right': '→',
			trap: 'X',
			lava: '▒',
			portal: '☉',
		};

		const gridSize = 10;
		const grid = [];
		let player = null;
		let gameStarted = false;
		let tickInterval = null;
		let levelTitle = '';
		let levelAuthor = '';

		const statusEl = container.querySelector('#status');
		const gridEl = container.querySelector('#grid');

		function setStatus(msg) {
			statusEl.textContent = msg;
		}

		function createGrid() {
			gridEl.style.gridTemplateColumns = `repeat(${gridSize}, 25px)`;
			gridEl.style.gridTemplateRows = `repeat(${gridSize}, 25px)`;
			for (let y = 0; y < gridSize; y++) {
				grid[y] = [];
				for (let x = 0; x < gridSize; x++) {
					const cell = { x, y, type: 'wall' };
					grid[y][x] = cell;

					const div = document.createElement('div');
					div.style.cssText = 'color: #0f0; width: 25px; height: 25px; font-size: 16px; display: flex; align-items: center; justify-content: center; cursor: pointer; background-color: #000; border: 1px solid #333;';
					div.dataset.x = x;
					div.dataset.y = y;
					div.innerText = TILE_SYMBOLS[cell.type];

					div.addEventListener('click', () => {
						if (gameStarted) return;
						cycleTile(cell, div, false);
					});
					div.addEventListener('contextmenu', (e) => {
						e.preventDefault();
						if (gameStarted) return;
						cycleTile(cell, div, true);
					});

					cell.el = div;
					gridEl.appendChild(div);
				}
			}
		}

		function cycleTile(cell, el, backwards = false) {
			const currentIndex = TILE_TYPES.indexOf(cell.type);
			let nextIndex;
			if (backwards) {
				nextIndex = (currentIndex - 1 + TILE_TYPES.length) % TILE_TYPES.length;
			} else {
				nextIndex = (currentIndex + 1) % TILE_TYPES.length;
			}
			cell.type = TILE_TYPES[nextIndex];
			el.innerText = TILE_SYMBOLS[cell.type];
		}

		function renderGrid() {
			for (let row of grid) {
				for (let cell of row) {
					cell.el.innerText = TILE_SYMBOLS[cell.type];
				}
			}
			if (player && getCell(player.x, player.y)) {
				grid[player.y][player.x].el.innerText = TILE_SYMBOLS.player;
			}
		}

		function findAllStarts() {
			const starts = [];
			for (let row of grid) {
				for (let cell of row) {
					if (cell.type === 'start') starts.push({ x: cell.x, y: cell.y });
				}
			}
			return starts;
		}

		function getCell(x, y) {
			if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return null;
			return grid[y][x];
		}

		function startTickLoop() {
			const tickDuration = 100;
			if (tickInterval) clearInterval(tickInterval);

			tickInterval = setInterval(() => {
				if (!gameStarted) return;

				if (player.moveDirection) {
					const nextX = player.x + player.moveDirection.dx;
					const nextY = player.y + player.moveDirection.dy;
					const nextCell = getCell(nextX, nextY);

					if (!nextCell || nextCell.type === 'wall') {
						player.moveDirection = null;
					} else {
						player.x = nextX;
						player.y = nextY;

						if (nextCell.type === 'portal') {
							for (let row of grid) {
								for (let cell of row) {
									if (cell.type === 'portal' && (cell.x !== nextX || cell.y !== nextY)) {
										player.x = cell.x;
										player.y = cell.y;
										break;
									}
								}
							}
						}
						if (nextCell.type === 'lava') {
							setStatus('You Died');
							resetGame();
							return;
						}
						if (nextCell.type === 'sticky') {
							player.moveDirection = null;
							player.onSticky = true;
						}
					}
				}

				if (!player.moveDirection) {
					const currentCell = getCell(player.x, player.y);

					if (currentCell && currentCell.type === 'end') {
						clearInterval(tickInterval);
						tickInterval = null;
						gameStarted = false;
						renderGrid();
						setStatus('You Won!');
						return;
					}

					if (currentCell && currentCell.type === 'trap') {
						setStatus('You Died');
						resetGame();
						return;
					}

					if (currentCell && currentCell.type.startsWith('conveyor')) {
						let dx = 0, dy = 0;
						const dir = currentCell.type.split('-')[1];
						switch (dir) {
							case 'up': dy = -1; break;
							case 'down': dy = 1; break;
							case 'left': dx = -1; break;
							case 'right': dx = 1; break;
						}
						const nextCell = getCell(player.x + dx, player.y + dy);
						if (nextCell && nextCell.type !== 'wall') {
							player.x += dx;
							player.y += dy;

							if (nextCell.type === 'lava') {
								setStatus('You Died');
								resetGame();
								return;
							}
						}
					}
				}

				renderGrid();
			}, tickDuration);
		}

		function setMoveDirection(dx, dy) {
			if (!gameStarted) return;
			if (!player.moveDirection || player.onSticky) {
				player.moveDirection = { dx, dy };
				player.onSticky = false;
			}
		}

		function resetGame() {
			setStatus('');
			if (tickInterval) clearInterval(tickInterval);
			tickInterval = null;
			gameStarted = false;
			player = null;
			renderGrid();
		}

		function validatePortals() {
			let portalCount = 0;
			for (let row of grid) {
				for (let cell of row) {
					if (cell.type === 'portal') portalCount++;
				}
			}
			if (portalCount !== 2 && portalCount !== 0) {
				alert('Level must have exactly 2 portals!');
				return false;
			}
			return true;
		}

		function encodeBase64Unicode(str) {
			return btoa(
				encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
					(_, p1) => String.fromCharCode('0x' + p1)
				)
			);
		}

		function decodeBase64Unicode(str) {
			return decodeURIComponent(
				Array.from(atob(str), c =>
					'%' + c.charCodeAt(0).toString(16).padStart(2, '0')
				).join('')
			);
		}

		function exportLevel() {
			const title = prompt('Enter level title:', levelTitle);
			if (title === null) return;
			levelTitle = title;

			const author = prompt('Enter author name:', levelAuthor);
			if (author === null) return;
			levelAuthor = author;

			const data = {
				title: levelTitle,
				author: levelAuthor,
				grid: grid.map(row => row.map(cell => cell.type))
			};

			const code = encodeBase64Unicode(JSON.stringify(data));
			prompt('Copy this save code:', code);
		}

		function loadFromCode(code) {
			try {
				const data = JSON.parse(decodeBase64Unicode(code));
				levelTitle = data.title || 'Untitled Level';
				levelAuthor = data.author || 'Unknown';

				for (let y = 0; y < gridSize; y++) {
					for (let x = 0; x < gridSize; x++) {
						grid[y][x].type = data.grid[y][x];
					}
				}

				player = null;
				gameStarted = false;
				renderGrid();
				alert(`Level loaded!\n${levelTitle} By: ${levelAuthor}`);
			} catch {
				alert('Invalid save code!');
			}
		}

		// Event listeners
		document.addEventListener('keydown', (e) => {
			if (e.key === 'Tab') {
				e.preventDefault();
				const starts = findAllStarts();
				if (starts.length === 0) {
					alert('Set a start tile first!');
					return;
				}
				if (starts.length > 1) {
					alert('Multiple start tiles detected. Please ensure exactly one start before starting.');
					return;
				}

				if (!validatePortals()) return;

				player = { x: starts[0].x, y: starts[0].y, moveDirection: null, onSticky: false };
				gameStarted = true;
				renderGrid();
				startTickLoop();
				return;
			}

			if (e.key === 'r' || e.key === 'R') {
				resetGame();
				return;
			}

			if (!gameStarted) return;

			switch (e.key) {
				case 'ArrowUp': setMoveDirection(0, -1); break;
				case 'ArrowDown': setMoveDirection(0, 1); break;
				case 'ArrowLeft': setMoveDirection(-1, 0); break;
				case 'ArrowRight': setMoveDirection(1, 0); break;
			}
		});

		document.addEventListener('keydown', (e) => {
			if (e.key === 'o' || e.key === 'O') {
				exportLevel();
			} else if (e.key === 'p' || e.key === 'P') {
				const code = prompt('Paste your save code:');
				if (code) loadFromCode(code);
			}
		});

		createGrid();
		renderGrid();

		// Allow exiting with ESC key
		const escapeHandler = (e) => {
			if (e.key === 'Escape') {
				document.removeEventListener('keydown', escapeHandler);
				onExit();
			}
		};
		document.addEventListener('keydown', escapeHandler);
	});
}

export default slidtrix;
