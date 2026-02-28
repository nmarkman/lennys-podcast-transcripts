export class Minimap {
  constructor(roomMeta) {
    this.canvas = document.getElementById('minimap');
    this.ctx = this.canvas.getContext('2d');
    this.roomMeta = roomMeta;
    this.size = 200;

    // Calculate scale to fit all rooms
    let maxDist = 0;
    for (const room of Object.values(roomMeta)) {
      const dist = Math.sqrt(room.center.x ** 2 + room.center.z ** 2) + (room.size || 20);
      if (dist > maxDist) maxDist = dist;
    }
    this.scale = (this.size * 0.4) / maxDist;
    this.centerX = this.size / 2;
    this.centerY = this.size / 2;
  }

  update(playerPosition) {
    const ctx = this.ctx;
    const s = this.scale;

    // Clear
    ctx.clearRect(0, 0, this.size, this.size);

    // Background
    ctx.fillStyle = 'rgba(10, 10, 30, 0.8)';
    ctx.beginPath();
    ctx.roundRect(0, 0, this.size, this.size, 10);
    ctx.fill();

    // Draw rooms
    for (const [id, room] of Object.entries(this.roomMeta)) {
      const x = this.centerX + room.center.x * s;
      const y = this.centerY - room.center.z * s;
      const halfSize = (room.size || 20) * s * 0.5;

      if (id === 'lobby') {
        // Circle for lobby
        ctx.beginPath();
        ctx.arc(x, y, halfSize, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(74, 144, 217, 0.2)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(74, 144, 217, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        // Rectangle for rooms
        ctx.fillStyle = room.color + '33'; // 20% opacity
        ctx.fillRect(x - halfSize, y - halfSize, halfSize * 2, halfSize * 2);
        ctx.strokeStyle = room.color + '88';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - halfSize, y - halfSize, halfSize * 2, halfSize * 2);

        // Room label (abbreviated)
        ctx.fillStyle = room.color;
        ctx.font = '8px sans-serif';
        ctx.textAlign = 'center';
        const shortName = room.name.replace(/^The /, '').substring(0, 8);
        ctx.fillText(shortName, x, y + 3);
      }
    }

    // Draw corridors as lines from lobby to rooms
    for (const [id, room] of Object.entries(this.roomMeta)) {
      if (id === 'lobby') continue;
      const rx = this.centerX + room.center.x * s;
      const ry = this.centerY - room.center.z * s;
      ctx.beginPath();
      ctx.moveTo(this.centerX, this.centerY);
      ctx.lineTo(rx, ry);
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw player
    const px = this.centerX + playerPosition.x * s;
    const py = this.centerY - playerPosition.z * s;
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
