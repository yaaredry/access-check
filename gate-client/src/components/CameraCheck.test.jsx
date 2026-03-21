import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CameraCheck from './CameraCheck';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: { verifyImage: vi.fn() },
}));

function uploadFile(file) {
  const input = document.getElementById('camera-input');
  fireEvent.change(input, { target: { files: [file] } });
}

const fakeImage = new File(['img'], 'id.jpg', { type: 'image/jpeg' });

describe('CameraCheck', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders heading and Open Camera label', () => {
    render(<CameraCheck onBack={vi.fn()} onSwitch={vi.fn()} />);
    expect(screen.getByText('Scan ID Card')).toBeInTheDocument();
    expect(screen.getByText('Open Camera')).toBeInTheDocument();
  });

  it('calls onBack when Back button is clicked', () => {
    const onBack = vi.fn();
    render(<CameraCheck onBack={onBack} onSwitch={vi.fn()} />);
    fireEvent.click(screen.getByText('← Back'));
    expect(onBack).toHaveBeenCalled();
  });

  it('calls onSwitch when switch button is clicked', () => {
    const onSwitch = vi.fn();
    render(<CameraCheck onBack={vi.fn()} onSwitch={onSwitch} />);
    fireEvent.click(screen.getByText('✏️ Switch to Enter ID Manually'));
    expect(onSwitch).toHaveBeenCalled();
  });

  it('shows loading and hides nav buttons while processing', async () => {
    api.verifyImage.mockImplementation(() => new Promise(() => {}));
    render(<CameraCheck onBack={vi.fn()} onSwitch={vi.fn()} />);
    uploadFile(fakeImage);
    await waitFor(() => expect(screen.getByText('Processing image…')).toBeInTheDocument());
    expect(screen.queryByText('← Back')).not.toBeInTheDocument();
    expect(screen.queryByText('✏️ Switch to Enter ID Manually')).not.toBeInTheDocument();
  });

  it('shows verdict after successful image verification', async () => {
    api.verifyImage.mockResolvedValue({ verdict: 'APPROVED', identifierValue: '000000018' });
    render(<CameraCheck onBack={vi.fn()} onSwitch={vi.fn()} />);
    uploadFile(fakeImage);
    await waitFor(() => expect(screen.getByText('APPROVED')).toBeInTheDocument());
    expect(screen.getByText('000000018')).toBeInTheDocument();
  });

  it('shows error when image verification fails', async () => {
    api.verifyImage.mockRejectedValue(new Error('OCR failed'));
    render(<CameraCheck onBack={vi.fn()} onSwitch={vi.fn()} />);
    uploadFile(fakeImage);
    await waitFor(() => expect(screen.getByText('OCR failed')).toBeInTheDocument());
  });

  it('returns to camera view from VerdictDisplay when Back is clicked', async () => {
    api.verifyImage.mockResolvedValue({ verdict: 'NOT_APPROVED' });
    render(<CameraCheck onBack={vi.fn()} onSwitch={vi.fn()} />);
    uploadFile(fakeImage);
    await waitFor(() => screen.getByText('NOT APPROVED'));
    fireEvent.click(screen.getByText('← Back'));
    expect(screen.getByText('Open Camera')).toBeInTheDocument();
  });

  it('Abort button aborts the in-flight request', async () => {
    let capturedSignal;
    api.verifyImage.mockImplementation((_file, signal) => {
      capturedSignal = signal;
      return new Promise(() => {});
    });
    render(<CameraCheck onBack={vi.fn()} onSwitch={vi.fn()} />);
    uploadFile(fakeImage);
    await waitFor(() => screen.getByText('✕ Abort'));
    fireEvent.click(screen.getByText('✕ Abort'));
    expect(capturedSignal?.aborted).toBe(true);
  });

  it('does nothing when file input fires with no file', () => {
    render(<CameraCheck onBack={vi.fn()} onSwitch={vi.fn()} />);
    const input = document.getElementById('camera-input');
    fireEvent.change(input, { target: { files: [] } });
    expect(api.verifyImage).not.toHaveBeenCalled();
  });
});
