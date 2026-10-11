"""Piccole immagini PNG di prova, senza librerie esterne."""
import zlib, struct
def png(color, size=120):
    r, g, b = color
    raw = b''.join(b'\x00' + bytes([r, g, b]) * size for _ in range(size))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')
