import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ParticipantEntity } from '../common/entities/ParticipantEntity';
import { GOLDEN_RATIO } from '../common/Constants';

@Injectable()
export class ColorService {
  constructor(
    @InjectRepository(ParticipantEntity)
    private readonly participantRepository: Repository<ParticipantEntity>,
  ) {}

  private hslToRgb(h: number, s: number, l: number): [number, number, number] {
    let r: number, g: number, b: number;
    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      const hue2rgb = (t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      r = hue2rgb(h + 1 / 3);
      g = hue2rgb(h);
      b = hue2rgb(h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  private rgbToHex(r: number, g: number, b: number): string {
    const toHex = (x: number) => x.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const clean = hex.replace(/^#/, '');
    const num = parseInt(clean, 16);
    return {
      r: (num >> 16) & 0xff,
      g: (num >> 8) & 0xff,
      b: num & 0xff,
    };
  }

  private rgbToHslNormalized(
    r: number,
    g: number,
    b: number,
  ): { h: number; s: number; l: number } {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    let h = 0,
      s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / d + 2) / 6;
          break;
        case b:
          h = ((r - g) / d + 4) / 6;
          break;
      }
    }

    return { h, s, l };
  }

  async generateNextHexColor(presentationId: number): Promise<string> {
    const last = await this.participantRepository
      .createQueryBuilder('p')
      .select('p.color', 'color')
      .where('p.presentation = :id', { id: presentationId })
      .orderBy('p.participantId', 'DESC')
      .getRawOne<{ color: string }>();

    let hue: number;
    if (last?.color) {
      const { r, g, b } = this.hexToRgb(last.color);
      ({ h: hue } = this.rgbToHslNormalized(r, g, b));
    } else {
      hue = Math.random();
    }

    const nextHue = (hue + GOLDEN_RATIO) % 1;

    const [r, g, b] = this.hslToRgb(nextHue, 0.75, 0.6);
    return this.rgbToHex(r, g, b);
  }
}
