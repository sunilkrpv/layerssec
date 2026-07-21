import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateProjectDto } from './create-project.dto';

describe('CreateProjectDto', () => {
  it('accepts a minimal payload', async () => {
    const dto = plainToInstance(CreateProjectDto, { name: 'Acme' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts metadata fields', async () => {
    const dto = plainToInstance(CreateProjectDto, {
      name: 'Acme',
      techStack: ['Node', 'Postgres'],
      environment: 'PROD',
      compliance: ['SOC2', 'PCI'],
      notes: 'critical app',
      repoUrl: 'https://github.com/x/y',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects unknown environment', async () => {
    const dto = plainToInstance(CreateProjectDto, { name: 'Acme', environment: 'BOGUS' });
    const errors = await validate(dto);
    expect(errors.find(e => e.property === 'environment')).toBeDefined();
  });

  it('rejects unknown compliance value', async () => {
    const dto = plainToInstance(CreateProjectDto, { name: 'Acme', compliance: ['BOGUS'] });
    const errors = await validate(dto);
    expect(errors.find(e => e.property === 'compliance')).toBeDefined();
  });
});
