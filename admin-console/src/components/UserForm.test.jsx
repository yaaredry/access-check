import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import UserForm from './UserForm';

describe('UserForm — canExtend', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders checkbox checked by default in create mode (no initial prop)', () => {
    render(<UserForm onSubmit={vi.fn()} onCancel={vi.fn()} loading={false} />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  it('unchecking checkbox → onSubmit called with canExtend: false', async () => {
    const onSubmit = vi.fn().mockResolvedValue();
    render(
      <UserForm
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        loading={false}
      />
    );
    // Fill required fields
    fireEvent.change(screen.getByPlaceholderText('user@example.com'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Display name'), { target: { value: 'Test User' } });
    // Uncheck the canExtend checkbox
    fireEvent.click(screen.getByRole('checkbox'));
    // Submit
    fireEvent.submit(document.querySelector('form'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ canExtend: false })
    ));
  });

  it('edit mode with initial.can_extend = false → checkbox is unchecked', () => {
    render(
      <UserForm
        initial={{ username: 'a@b.com', name: 'A', max_request_days: 7, can_extend: false }}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        loading={false}
      />
    );
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('edit mode with initial.can_extend = true → checkbox is checked', () => {
    render(
      <UserForm
        initial={{ username: 'a@b.com', name: 'A', max_request_days: 7, can_extend: true }}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        loading={false}
      />
    );
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('edit mode with initial.can_extend absent → checkbox defaults to checked', () => {
    render(
      <UserForm
        initial={{ username: 'a@b.com', name: 'A', max_request_days: 7 }}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        loading={false}
      />
    );
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('canExtend present in submit payload alongside maxRequestDays', async () => {
    const onSubmit = vi.fn().mockResolvedValue();
    render(
      <UserForm
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        loading={false}
      />
    );
    fireEvent.change(screen.getByPlaceholderText('user@example.com'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Display name'), { target: { value: 'Test User' } });
    fireEvent.submit(document.querySelector('form'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ maxRequestDays: 7, canExtend: true })
    ));
  });
});
