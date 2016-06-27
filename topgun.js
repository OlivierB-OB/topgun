
topgun(window, document.getElementById('game-screen'));

function topgun (window, canvas) {

    var context = canvas.getContext('2d');

    /* KEYBOARD HANDLING */

    function KeyBoard() {
        var state = {};
        window.addEventListener('keydown', function(e) {
            state[e.keyCode] = true;
        });
        window.addEventListener('keyup', function(e) {
            state[e.keyCode] = false;
        });
        this.isDown = function (key) {
            return state[key];
        };
    }
    KeyBoard.KEYS = {
        SPACE: 32,
        LEFT: 37,
        UP: 38,
        RIGHT: 39,
        DOWN: 40
    };

    /* VECTOR */

    function Vector (x, y) {
        this.x = x;
        this.y = y;
    }

    Vector.NULL = new Vector(0, 0);
    Vector.scalarProduct = function (a, b) {
        if (!(a instanceof Vector)) throw new TypeError();
        if (!(b instanceof Vector)) throw new TypeError();
        return a.x * b.x + a.y * b.y;
    };

    Vector.prototype.plus = function (vector) {
        if (!(vector instanceof Vector)) throw new TypeError();
        return new Vector(this.x + vector.x, this.y + vector.y);
    };
    Vector.prototype.minus = function (vector) {
        if (!(vector instanceof Vector)) throw new TypeError();
        return new Vector(this.x - vector.x, this.y - vector.y);
    };
    Vector.prototype.reverse = function () {
        return new Vector(-this.x, -this.y);
    };
    Vector.prototype.getNorm = function (vector) {
        return Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));
    };
    Vector.prototype.getDegWith = function (vector) {
        return Angle.toDeg(Math.acos(
            Vector.scalarProduct(this, vector) /
            (this.getNorm() * vector.getNorm())
        ));
    };

    /* POSITION */

    function Position (x, y) {
        this.x = x;
        this.y = y;
    }

    Position.vectorBetween = function (a, b) {
        if (!(a instanceof Position)) throw new TypeError();
        if (!(b instanceof Position)) throw new TypeError();
        return new Vector(b.x - a.x, b.y - a.y);
    };

    Position.prototype = Object.create(Vector.prototype);
    Position.prototype.constructor = Position;

    Position.prototype.move = function (vector) {
        this.x += vector.x;
        this.y += vector.y;
        return this;
    };
    Position.prototype.clone = function () {
        return new Position(this.x, this.y);
    };

    /* ANGLE */

    function Angle (deg, rad) {
        this.deg = deg;
        this.rad = rad;
    }

    Angle.cache = {deg: {}, rad: {}};
    Angle.fromDeg = function (deg) {
        if (!(deg in Angle.cache.deg)) {
            Angle.cache.deg[deg] = new Angle(deg, Angle.toRad(deg));
        }
        return Angle.cache.deg[deg];
    };
    Angle.fromRad = function (rad) {
        if (!(rad in Angle.cache.rad)) {
            Angle.cache.rad[rad] = new Angle(Angle.toDeg(rad), rad);
        }
        return Angle.cache.rad[rad];
    };
    Angle.toDeg = function (rad) {
        return rad * 180 / Math.PI;
    };
    Angle.toRad = function (deg) {
        return deg * Math.PI / 180;
    };
    Angle.mod = function (val, n) {
        return ((val % n) + n) % n;
    };
    Angle.diffDeg = function (source, target) {
        var a = target - source;
        return Angle.mod(a + 180, 360) - 180;
    };

    [0, 1, 2, 5, 10, 30, 45, 60, 90, 120, 180, 270].forEach(function (angle) {
        Angle['d' + angle] = Angle.fromDeg(angle);
    });

    Angle.prototype.plus = function (angle) {
        if (!(angle instanceof Angle)) throw new TypeError();
        return Angle.fromDeg(Angle.mod(this.deg + angle.deg, 360));
    };
    Angle.prototype.minus = function (angle) {
        if (!(angle instanceof Angle)) throw new TypeError();
        return Angle.fromDeg(Angle.mod(this.deg - angle.deg, 360));
    };
    Angle.prototype.reverse = function () {
        return Angle.fromDeg(Angle.mod(-this.deg, 360));
    };

    /* SPEED */

    function Speed (value, angle) {
        this.value = value;
        this.changeAngle(angle);
    }

    Speed.prototype.changeValue = function (value) {
        this.value = value;
        this.computeVector();
    };
    Speed.prototype.changeAngle = function (angle) {
        if (!(angle instanceof Angle)) throw new TypeError();
        this.angle = angle;
        this.computeVector();
    };
    Speed.prototype.computeVector = function (direction) {
        this.vector = new Vector(
            Math.cos(this.angle.rad) * this.value,
            Math.sin(this.angle.rad) * this.value
        );
    };
    Speed.prototype.getVector = function () {
        return this.vector;
    };

    /* BASIS */

    function BasisTransformation () {
        this.setTranslation(Vector.NULL);
        this.setRotation(Angle.d0);
    }

    BasisTransformation.prototype.setTranslation = function (vector) {
        if (!(vector instanceof Vector)) throw new TypeError();
        this.translation = vector;
        this.r_translation = this.translation.reverse();
    };
    BasisTransformation.prototype.setRotation = function (angle) {
        if (!(angle instanceof Angle)) throw new TypeError();
        this.rotation = angle;
        this.r_rotation = this.rotation.reverse();
    };
    BasisTransformation.prototype.getPolarPosition = function (position) {
        if (!(position instanceof Vector)) throw new TypeError();
        position = this.r_translation.plus(position);
        var r = position.getNorm();
        var o = Math.atan2(position.y, position.x);
        var tmp1 = Angle.toDeg(o);
        o = o + this.r_rotation.rad;
        var tmp2 = Angle.toDeg(o);
        return {r: r, o: o};
    };
    BasisTransformation.prototype.getPosition = function (position) {
        var polar = this.getPolarPosition(position);
        return new Position(
            polar.r * Math.cos(polar.o),
            polar.r * Math.sin(polar.o)
        );
    };
    BasisTransformation.prototype.getAngle = function (angle) {
        if (!(angle instanceof Angle)) throw new TypeError();
        return angle.plus(this.r_rotation);
    };
    BasisTransformation.prototype.getRadarPosition = function (position, maxR, radarRatio) {
        var polar = this.getPolarPosition(position);
        polar.r = Math.min(maxR, polar.r / radarRatio);
        return new Position(
            polar.r * Math.cos(polar.o),
            polar.r * Math.sin(polar.o)
        );
    };

    /* SIZE */

    function Size (width, height) {
        this.height = height;
        this.width = width;
        this.half = {
            height: Math.floor(height / 2),
            width: Math.floor(width / 2)
        };
    }
    Size.prototype.area = function () {
        if (!this._area) {
            this._area = this.height * this.width;
        }
        return this._area;
    };

    /* ELEMENT */

    function Element (basis, position, speed) {
        if (!(basis instanceof BasisTransformation)) throw new TypeError();
        if (!(position instanceof Position)) throw new TypeError();
        if (!(speed instanceof Speed)) throw new TypeError();
        this.basis = basis;
        this.position = position;
        this.speed = speed;
    }

    Element.prototype.move = function () {
        this.position.move(this.speed.vector);
    };
    Element.prototype.changeDirection = function (angle) {
        if (!(angle instanceof Angle)) throw new TypeError();
        angle = this.speed.angle.plus(angle);
        this.speed.changeAngle(angle);
    };
    Element.prototype.changeSpeed = function (value) {
        value += this.speed.value;
        this.speed.changeValue(value);
    };
    Element.prototype.getBasisPosition = function () {
        return this.basis.getPosition(this.position);
    };
    Element.prototype.getBasisAngle = function () {
        return this.basis.getAngle(this.speed.angle);
    };

    /* GAME ELEMENT */

    function GameElement (game, position, speed, size) {
        if (!(game instanceof Game)) throw new TypeError();
        if (!(size instanceof Size)) throw new TypeError();
        Element.call(this, game.basis, position, speed);
        this.game = game;
        this.size = size;
        this._delete = false;
    }


    GameElement.prototype = Object.create(Element.prototype);
    GameElement.prototype.constructor = GameElement;

    GameElement.update = function (element) {
        if (!(element instanceof GameElement)) throw new TypeError();
        element.update();
    };
    GameElement.draw = function (element) {
        if (!(element instanceof GameElement)) throw new TypeError();
        element.safeDraw();
    };
    GameElement.radarDraw = function (radarRadius, radarRatio, element) {
        if (!(element instanceof GameElement)) throw new TypeError();
        element.radarDraw(radarRadius, radarRatio);
    };
    GameElement.inGame = function (element) {
        if (!(element instanceof GameElement)) throw new TypeError();
        return !element._delete;
    };
    GameElement.colliding = function (a, b) {
        if (!(a instanceof GameElement)) throw new TypeError();
        if (!(b instanceof GameElement)) throw new TypeError();
        return !(
            a === b ||
            a.position.x + a.size.half.width < b.position.x - b.size.half.width ||
            a.position.y + a.size.half.height < b.position.y - b.size.half.height ||
            a.position.x - a.size.half.width > b.position.x + b.size.half.width ||
            a.position.y - a.size.half.height > b.position.y + b.size.half.height
        );
    };
    GameElement.prototype.update = function () {
        this.move();
    };
    GameElement.prototype.safeDraw = function () {
        var position = this.getBasisPosition(this.position);
        var angle = this.getBasisAngle(this.speed.angle);
        context.save();
        context.translate(position.x, position.y);
        context.rotate(angle.rad);
        this.draw();
        context.restore();
    };
    GameElement.prototype.radarDraw = function (radarRadius, radarRatio) {
        var position = this.getRadarPosition(radarRadius, radarRatio);
        context.save();
        context.translate(position.x, position.y);
        context.beginPath();
        context.arc(0, 0, 2, 0, 2 * Math.PI, false);
        context.fillStyle = 'red';
        context.fill();
        context.restore();
    };
    GameElement.prototype.draw = function () {
        throw new Error('Not implemented');
    };
    GameElement.prototype.delete = function () {
        this._delete = true;
    };
    GameElement.prototype.getRadarPosition = function (radarRadius, radarRatio) {
        return this.basis.getRadarPosition(this.position, radarRadius, radarRatio);
    };

    /* GAME */

    function Game () {
        this.message = '';
        this.opponents = [];
        this.bullets = [];
        this.clouds = [];
        this.explosions = [];
        this.smoke = [];
        this.elements = [];
        this.size = new Size(canvas.height, canvas.width);
        this.basis = new BasisTransformation();
        this.wave = 0;

        this.refresh = function () {
            if (!GameElement.inGame(this.player)) {
                this.message = 'Game Over!!!';
                this.drawMessage();
                return;
            }
            this.update();
            this.clear();
            this.draw();
            this.drawRadar();
            this.drawLife();
            this.drawSpeed();
            if (this.message) this.drawMessage();
            requestAnimationFrame(this.refresh);
        }.bind(this);

        this.init();
    }

    Game.MESSAGE_DURATION = 1500;

    Game.prototype.init = function () {
        this.player = new Player(this);
        this.refresh();
    };
    Game.prototype.update = function () {
        if (!this.opponents.length) this.createWave();
        this.handleCollisions();
        this.handleDeletion();
        while (this.clouds.length < 10) {
            var cloud = new Cloud(this);
            this.addElement(cloud);
        }
        this.elements = this.clouds.concat(this.smoke, this.opponents, [this.player], this.bullets, this.explosions);
        this.elements.forEach(GameElement.update);
    };
    Game.prototype.clear = function () {
        context.clearRect(0, 0, this.size.width, this.size.height);
    };
    Game.prototype.draw = function () {
        context.save();
        context.translate(this.size.half.width, this.size.half.height);
        context.rotate(Angle.d270.rad);
        this.elements.forEach(GameElement.draw);
        context.restore();
    };
    Game.prototype.drawRadar = function () {
        var radarRadius = 50, radarRatio = 15;
        context.save();
        context.translate(this.size.width - radarRadius, this.size.height - radarRadius);
        context.rotate(Angle.d270.rad);
        context.beginPath();
        context.arc(0, 0, radarRadius, 0, 2 * Math.PI, false);
        context.fillStyle = 'black';
        context.fill();
        this.opponents.concat([this.player]).forEach(GameElement.radarDraw.bind(0, radarRadius, radarRatio));
        context.restore();
    };
    Game.prototype.drawLife = function () {
        var pLife = this.player.life * 100 / Player.LIFE;
        context.save();
        context.translate(10, this.size.height - 112);
        context.fillStyle = 'black';
        context.fillRect(0, 0, 12, 102);
        context.restore();
        context.save();
        context.translate(11, this.size.height - pLife - 11);
        context.fillStyle = 'red';
        context.fillRect(0, 0, 10, pLife);
        context.restore();
    };
    Game.prototype.drawSpeed = function () {
        var pSpeedDelta = Player.MAX_SPEED - Player.MIN_SPEED;
        var pSpeed = (this.player.speed.value - Player.MIN_SPEED) * 100 / pSpeedDelta;
        context.save();
        context.translate(30, this.size.height - 112);
        context.fillStyle = 'black';
        context.fillRect(0, 0, 12, 102);
        context.restore();
        context.save();
        context.translate(31, this.size.height - pSpeed - 11);
        context.fillStyle = 'yellow';
        context.fillRect(0, 0, 10, pSpeed);
        context.restore();
    };
    Game.prototype.drawMessage = function () {
        context.save();
        context.font = '30px Arial';
        context.textAlign='center';
        context.fillStyle = '#555';
        context.fillText(this.message, canvas.width / 2, canvas.height / 2 - 50);
        context.restore();
    };
    Game.prototype.addElement = function (element) {
        if (element instanceof Bullet) this.bullets.push(element);
        else if (element instanceof Cloud) this.clouds.push(element);
        else if (element instanceof Explosion) this.explosions.push(element);
        else if (element instanceof Smoke) this.smoke.push(element);
        else this.opponents.push(element);
    };
    Game.prototype.handleCollisions = function () {
        var elements = this.opponents.concat([this.player], this.bullets);
        for (var i = 0; i < elements.length - 1; i++) {
            for (var j = i + 1; j < elements.length; j++) {
                if (!GameElement.colliding(elements[i], elements[j])) continue;
                elements[i].decreaseLife(1);
                elements[j].decreaseLife(1);
                var sizeA = elements[i].size.area();
                var sizeB = elements[j].size.area();
                this.addElement(new Explosion(this, sizeA > sizeB ? elements[i].position : elements[j].position));
            }
        }
    };
    Game.prototype.handleDeletion = function () {
        this.opponents = this.opponents.filter(GameElement.inGame);
        this.bullets = this.bullets.filter(GameElement.inGame);
        this.clouds = this.clouds.filter(GameElement.inGame);
        this.explosions = this.explosions.filter(GameElement.inGame);
        this.smoke = this.smoke.filter(GameElement.inGame);
    };
    Game.prototype.showText = function (message, final) {
        this.message = message;
        if (!final) setTimeout(this.showText.bind(this, '', true), Game.MESSAGE_DURATION);
    };
    Game.prototype.createWave = function () {
        this.player.life = Player.LIFE;
        this.wave++;
        this.showText('Wave: ' + this.wave);
        var posGenerator = new Speed(300, Angle.d0);
        var baseAngle = Math.floor(360 / this.wave);
        for (var i = 0; i < this.wave; i++) {
            posGenerator.changeAngle(Angle.fromDeg(i * baseAngle));
            this.opponent = new Opponent(this, new Position(
                this.player.position.x + posGenerator.vector.x,
                this.player.position.y + posGenerator.vector.y
            ));
            this.addElement(this.opponent);
        }
    };

    /* ALIVE ELEMENT */

    function AliveGameElement (game, position, speed, size, life) {
        GameElement.call(this, game, position, speed, size);
        this.life = life;
    }

    AliveGameElement.prototype = Object.create(GameElement.prototype);
    AliveGameElement.prototype.constructor = AliveGameElement;

    AliveGameElement.prototype.decreaseLife = function (value) {
        this.life = Math.max(this.life - value, 0);
        if (this.life === 0) this.delete();
    };

    /* TIMEOUTED ELEMENT */

    function TimeoutedElement(game, position, speed, size, duration) {
        GameElement.call(this, game, position, speed, size);
        this.date = new Date();
        this.duration = duration;
    }

    TimeoutedElement.prototype = Object.create(GameElement.prototype);
    TimeoutedElement.prototype.constructor = TimeoutedElement;

    TimeoutedElement.prototype.update = function () {
        GameElement.prototype.update.call(this);
        if (new Date() - this.date > this.duration) this.delete();
    };

    /* planes */

    function Plane(game, position, speed, life, fireRate, turnRate, imageId) {
        AliveGameElement.call(this, game, position, speed, Plane.SIZE, life);
        this.allowShooting = true;
        this.allowTurning = true;
        this.fireRate = fireRate;
        this.turningRate = turnRate;
        this.imageId = imageId;
        this.lastDirection = '';
    }

    Plane.SIZE = new Size(50, 28);

    Plane.prototype = Object.create(AliveGameElement.prototype);
    Plane.prototype.constructor = Plane;

    Plane.prototype.draw = function () {
        var img = document.getElementById(this.imageId + this.lastDirection);
        context.translate(-this.size.half.width, -this.size.half.height);
        context.drawImage(img, 0, 0);
    };
    Plane.prototype.toogleShooting = function (final) {
        this.allowShooting = !this.allowShooting;
        if (!final) setTimeout(this.toogleShooting.bind(this, true), this.fireRate);
    };
    Plane.prototype.toogleTurning = function (final) {
        this.allowTurning = !this.allowTurning;
        if (!final) setTimeout(this.toogleTurning.bind(this, true), this.turningRate);
    };
    Plane.prototype.turnLeft = function () {
        this.changeDirection(Angle.d1.reverse());
        this.toogleTurning();
        this.lastDirection = '-left';
    };
    Plane.prototype.turnRight = function () {
        this.changeDirection(Angle.d1);
        this.toogleTurning();
        this.lastDirection = '-right';
    };
    Plane.prototype.goStrait = function () {
        this.lastDirection = '';
    };
    Plane.prototype.shoot = function () {
        var start = this.position.clone(), i = 9;
        while (--i) start.move(this.speed.vector);
        var bullet = new Bullet(
            this.game,
            start,
            this.speed.angle
        );
        this.game.addElement(bullet);
        this.toogleShooting();
        
        try {
            var sound = document.getElementById('sound-shot');
            sound.load();
            sound.play().then(function () {}, function () {});
        }
        catch (e) {
            // only a sound issue
        }
    };
    Plane.prototype.releaseSmoke = function () {
        var smoke = new Smoke(this.game, this.position.clone(), this.speed.angle);
        this.game.addElement(smoke);
    };

    /* PLAYER */

    function Player(game) {
        Plane.call(this, game,
            new Position(0, 0),
            new Speed(Player.DEFAULT_SPEED, Angle.d0),
            Player.LIFE,
            Player.FIRE_RATE,
            Player.TURN_RATE,
            Player.IMAGE
        );
        this.basis.setTranslation(this.position);
        this.basis.setRotation(this.speed.angle);
        this.kb = new KeyBoard();
    }

    Player.MIN_SPEED = 4.5;
    Player.MAX_SPEED = 5.5;
    Player.DEFAULT_SPEED = 5;
    Player.FIRE_RATE = 200;
    Player.TURN_RATE = 10;
    Player.LIFE = 3;
    Player.IMAGE = 'player';

    Player.prototype = Object.create(Plane.prototype);
    Player.prototype.constructor = Player;

    Player.prototype.update = function () {
        Plane.prototype.update.call(this);
        this.basis.setTranslation(this.position);

        if (this.allowTurning && this.kb.isDown(KeyBoard.KEYS.LEFT)) {
            this.turnLeft();
        }
        else if (this.allowTurning && this.kb.isDown(KeyBoard.KEYS.RIGHT)) {
            this.turnRight();
        }
        else {
            this.goStrait();
        }
        if (this.speed.value + 0.05 <= Player.MAX_SPEED && this.kb.isDown(KeyBoard.KEYS.UP)) {
            this.changeSpeed(0.05);
        }
        else if (this.speed.value - 0.05 >= Player.MIN_SPEED && this.kb.isDown(KeyBoard.KEYS.DOWN)) {
            this.changeSpeed(-0.05);
        }

        if (this.allowShooting && this.kb.isDown(KeyBoard.KEYS.SPACE)) {
            this.shoot();
        }

        this.releaseSmoke();
    };
    Player.prototype.turnLeft = function () {
        Plane.prototype.turnLeft.call(this);
        this.basis.setRotation(this.speed.angle);
    };
    Player.prototype.turnRight = function () {
        Plane.prototype.turnRight.call(this);
        this.basis.setRotation(this.speed.angle);
    };

    /* OPPONENT */

    function Opponent(game, position) {
        Plane.call(this, game,
            position,
            new Speed(Opponent.SPEED, Angle.d0),
            Opponent.LIFE,
            Opponent.FIRE_RATE,
            Opponent.TURN_RATE,
            Opponent.IMAGE
        );
    }

    Opponent.SPEED = 5;
    Opponent.FIRE_RATE = 200;
    Opponent.TURN_RATE = 20;
    Opponent.LIFE = 1;
    Opponent.IMAGE = 'opponent';

    Opponent.prototype = Object.create(Plane.prototype);
    Opponent.prototype.constructor = Opponent;

    Opponent.prototype.update = function () {
        Plane.prototype.update.call(this);

        var bt = new BasisTransformation();
        bt.setTranslation(this.position);
        bt.setRotation(this.speed.angle);
        var polar = bt.getPolarPosition(this.game.player.position);
        var angle = Angle.diffDeg(0, Angle.toDeg(polar.o));

        var mustAvoid = false;
        var freeShot = true;
        //var closestFriendInRange = 0;

        this.game.opponents.forEach(function (friend) {
            if (this === friend) return;
            if (mustAvoid) return;
            polar = bt.getPolarPosition(friend.position);
            angle = Angle.diffDeg(0, Angle.toDeg(polar.o));
            if (polar.r < 200) {
                if (angle < 0) this.turnRight();
                else this.turnLeft();
                mustAvoid = true;
            }
            if (Math.abs(angle) < 2) {
                //closest = freeShot ? polar.r : Math.min(closest, polar.r);
                freeShot = false;
            }
        }, this);

        polar = bt.getPolarPosition(this.game.player.position);
        angle = Angle.diffDeg(0, Angle.toDeg(polar.o));

        if (this.allowTurning && !mustAvoid) {
            if (angle > 2) this.turnRight();
            else if (angle < -2) this.turnLeft();
            else this.goStrait();
        }

        if (this.allowShooting && freeShot && Math.abs(angle) < 0.5 && polar.r < Bullet.RANGE * Bullet.SPEED) {
            this.shoot();
        }

        this.releaseSmoke();
    };

    /* BULLET */

    function Bullet(game, position, angle) {
        AliveGameElement.call(this, game, position, new Speed(Bullet.SPEED, angle), Bullet.SIZE, Bullet.LIFE);
        this.range = Bullet.RANGE;
    }

    Bullet.SIZE = new Size(15, 2);
    Bullet.SPEED = 20;
    Bullet.RANGE = 200;
    Bullet.LIFE = 1;

    Bullet.prototype = Object.create(AliveGameElement.prototype);
    Bullet.prototype.constructor = Bullet;

    Bullet.prototype.update = function () {
        AliveGameElement.prototype.update.call(this);
        if (!--this.range) this.delete();
    };
    Bullet.prototype.draw = function () {
        context.translate(-this.size.half.width, -this.size.half.height);
        context.fillStyle = 'orangered';
        context.fillRect(0, 0, this.size.width, this.size.height);
    };

    /* CLOUD */

    function Cloud(game) {
        if (!(game instanceof Game)) throw new TypeError();
        var position = game.player.position.clone();
        var randPos = Math.floor(Math.random() * 4);
        switch (randPos) {
            case 0 :
                position.x += game.size.half.width + Cloud.SIZE.width;
                position.y += Math.floor(Math.random() * game.size.height) - game.size.half.height - Cloud.SIZE.half.height;
                break;
            case 1 :
                position.x -= game.size.half.width + Cloud.SIZE.width;
                position.y += Math.floor(Math.random() * game.size.height) - game.size.half.height - Cloud.SIZE.half.height;
                break;
            case 2 :
                position.x += Math.floor(Math.random() * game.size.width) - game.size.half.width - Cloud.SIZE.half.width;
                position.y += game.size.half.height + Cloud.SIZE.height;
                break;
            case 3 :
                position.x += Math.floor(Math.random() * game.size.width) - game.size.half.width - Cloud.SIZE.half.width;
                position.y -= game.size.half.height + Cloud.SIZE.height;
                break;
        }
        GameElement.call(this, game, position, new Speed(0, Angle.d0), Cloud.SIZE);
        this.coudType = Math.floor(Math.random() * 3) + 1;
    }

    Cloud.SIZE = new Size(400, 400);
    Cloud.RANGE = 1200;

    Cloud.prototype = Object.create(GameElement.prototype);
    Cloud.prototype.constructor = Cloud;

    Cloud.prototype.update = function () {
        var playerPos = this.game.player.position;
        var dist = Math.sqrt(Math.pow(playerPos.x - this.position.x, 2) + Math.pow(playerPos.y - this.position.y, 2));
        if (dist > Cloud.RANGE) this.delete();
    };
    Cloud.prototype.draw = function () {
        var img = document.getElementById('cloud-' + this.coudType);
        context.translate(-this.size.half.width, -this.size.half.height);
        context.drawImage(img, 0, 0);
    };

    /* EXPLOSION */

    function Explosion(game, position) {
        TimeoutedElement.call(this, game, position, new Speed(0, Angle.d0), Explosion.SIZE, Explosion.DURATION);

        try {
            var sound = document.getElementById('sound-explosion');
            sound.load();
            sound.play().then(function () {}, function () {});
        }
        catch (e) {
            // only a sound issue
        }
    }

    Explosion.SIZE = new Size(115, 100);
    Explosion.DURATION = 150;

    Explosion.prototype = Object.create(TimeoutedElement.prototype);
    Explosion.prototype.constructor = Explosion;

    Explosion.prototype.draw = function () {
        var img = document.getElementById('explosion');
        context.translate(-this.size.half.width, -this.size.half.height);
        context.drawImage(img, 0, 0);
    };

    /* SMOKE */

    function Smoke(game, position, angle) {
        TimeoutedElement.call(this, game, position, new Speed(0, angle), Smoke.SIZE, Smoke.DURATION);
    }

    Smoke.SIZE = new Size(6, 6);
    Smoke.DURATION = 3000;

    Smoke.prototype = Object.create(TimeoutedElement.prototype);
    Smoke.prototype.constructor = Smoke;

    Smoke.prototype.draw = function () {
        var img = document.getElementById('smoke');
        context.translate(-this.size.half.width, -this.size.half.height);
        context.drawImage(img, 0, 0);
    };

    /* START GAME */

    window.addEventListener('load', function() {
        new Game();
    });
}
