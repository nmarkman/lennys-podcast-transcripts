export class Minimap {
  constructor(loungeWidth, loungeDepth) {
    this.canvas = document.getElementById('minimap');
    this.ctx = this.canvas.getContext('2d');
    this.size = 200;
    this.loungeWidth = loungeWidth;
    this.loungeDepth = loungeDepth;
    // Scale to fit lounge in minimap with padding
    this.scale = (this.size * 0.8) / Math.max(loungeWidth, loungeDepth);
    this.centerX = this.size / 2;
    this.centerY = this.size / 2;
    this.guestPositions = [];
  }

  setGuestPositions(positions) {
    this.guestPositions = positions;
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

    // Lounge outline
    const lw = this.loungeWidth * s;
    const ld = this.loungeDepth * s;
    const lx = this.centerX - lw / 2;
    const ly = this.centerY - ld / 2;
    ctx.fillStyle = 'rgba(92, 61, 46, 0.2)';
    ctx.fillRect(lx, ly, lw, ld);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(lx, ly, lw, ld);

    // Stage area
    const stageW = 10 * s;
    const stageD = 6 * s;
    const stageX = this.centerX - stageW / 2;
    const stageY = this.centerY - (11 * s) - stageD / 2;
    ctx.fillStyle = 'rgba(74, 144, 217, 0.15)';
    ctx.fillRect(stageX, stageY, stageW, stageD);
    ctx.strokeStyle = 'rgba(74, 144, 217, 0.3)';
    ctx.strokeRect(stageX, stageY, stageW, stageD);

    // Stage label
    ctx.fillStyle = 'rgba(74, 144, 217, 0.6)';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Stage', this.centerX, stageY + stageD / 2 + 3);

    // Couch indicators
    const couches = [
      { x: -10, z: 0 },
      { x: 10, z: 0 },
      { x: -6, z: 7 },
      { x: 6, z: 7 },
    ];
    ctx.fillStyle = 'rgba(90, 74, 106, 0.3)';
    for (const c of couches) {
      const cx = this.centerX + c.x * s;
      const cy = this.centerY - c.z * s;
      ctx.fillRect(cx - 4, cy - 3, 8, 6);
    }

    // Guest dots
    for (const pos of this.guestPositions) {
      const gx = this.centerX + pos.x * s;
      const gy = this.centerY - pos.z * s;
      ctx.beginPath();
      ctx.arc(gx, gy, 3, 0, Math.PI * 2);
      ctx.fillStyle = pos.isHost ? '#4A90D9' : '#50C878';
      ctx.fill();
    }

    // Player dot
    const px = this.centerX + playerPosition.x * s;
    const py = this.centerY - playerPosition.z * s;
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
