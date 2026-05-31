import { IStockService } from '../interfaces/IServices';

export class MockStockService implements IStockService {
  async addStockMovement(movement: any): Promise<any> {
    return movement;
  }

  async getMovementHistory(variantId: string): Promise<any[]> {
    return [];
  }
}
